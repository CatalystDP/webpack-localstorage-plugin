(function (root) {
    var util = {
        is: function (obj, type) {
            return Object.prototype.toString.call(obj).replace(/\[|\]/g, '').substr(7).toLowerCase() === type;
        },
        isArray: function (obj) {
            return util.is(obj, 'array');
        },
        isFunction: function (obj) {
            return util.is(obj, 'function');
        },
        log: function () {
            console.log.apply(console, arguments);
        },
        addParams: function (obj) {

        },
        isSupportLocalStorage: function () {
            var testKey = 'testKey';
            if (!(window.localStorage && window.localStorage.getItem)) return;
            try {
                /**
                 * for some mobile browser like safari/chrome and so on
                   which has private mode and localStorage cannot be used
                 */
                window.localStorage.setItem(testKey, '1234567');
                window.localStorage.removeItem(testKey);
                return true;
            } catch (e) {
                return false;
            }
        }
    };
    var CACHE_FN_PREFIX = 'window.webpack_local_cache=window.webpack_local_cache||function(fn){fn()};' +
        'webpack_local_cache(function(){';//加上一些容错机制
    var CACHE_FN_SUFFIX = '}';
    var cachePrefix = 'chunk_';
    var isInited = false, entryLoaded = false;
    var option, publicPath, manifestObj;
    var reporter;
    var installedChunks = {};
    root.webpack_local_cache = function (fn, chunkName, hash) {
        var c = installedChunks[chunkName] = ChunkWrap(chunkName, hash, fn);
        if (option.disableCache) {
            //disable cache
            return;
        }
        if(!manifestObj[chunkName]){
            return;
        }
        var cache = {
            chunkName: chunkName,
            hash: hash,
            fn: fn.toString()
        }
        saveChunkToCache(cache);
    };
    /**
     * @param object opt
     *        @param opt.manifest   manifest obj which is generate by localstorage plugin 
     *        @param opt.publicPath   js publicPath
     *        @param opt.reporter reporter object
     *        @param opt.disableCache  
     */
    root.webpack_local_cache.init = function (opt) {
        if (isInited) return;
        option = opt || {};
        manifestObj = option.manifest||{};
        publicPath = opt.publicPath;
        reporter = opt.reporter || {};
        cachePrefix=option.cachePrefix||window.location.pathname;
        if (!util.isSupportLocalStorage()) {
            option.disableCache = true;//disable cache when localStorage is not support
        }
        if (!option.disableCache) {
            //clear cached chunk which are not in manifest
            for (var i=0, len = localStorage.length; i < len; ++i) {
                try {
                    var key=localStorage.key(i);
                    if(key && key.indexOf && key.indexOf(cachePrefix)>-1){
                        if(!manifestObj.hasOwnProperty(key.replace(cachePrefix,''))){
                            util.log('chunk '+key.replace(cachePrefix,'')+' will be removed');
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) { }
            }
        }
        isInited = true;
    };
    root.webpack_local_cache.getConfigs=function(){
        return option;
    };
    root.webpack_local_cache.getInstalledChunks=function(){
        return installedChunks;
    };
    root.webpack_local_cache.loadChunks = function (chunks, onLoadEnd) {
        if (!util.isArray(chunks)) return;
        var manifest = manifestObj || {};
        var len = chunks.length, count = 0;
        function onLoad() {
            this.onload = null;
            ++count;
            if (count == len) {
                chunks.forEach(function (chunk) {
                    var installedChunk = installedChunks[chunk];
                    if (installedChunk && !installedChunk.executed) {
                        util.log('chunk ' + chunk + ' will execute');
                        util.isFunction(installedChunk.fn) && installedChunk.fn.call(option.context||null);//context in fn
                        installedChunk.executed = true;
                    }
                });
                util.isFunction(onLoadEnd) && onLoadEnd();
            }
        }
        for (var i = 0; i < len; ++i) {
            var chunkName = chunks[i];
            var chunkInfo = manifest[chunkName];
            if (installedChunks[chunkName]) {
                util.log('chunk ' + chunkName + ' is installed');
                onLoad.call({});
                continue;
            }
            var cachedChunk = loadChunkFromCacahe(chunkName);
            if (cachedChunk && !option.disableCache) {
                cachedChunk = JSON.parse(cachedChunk);
                if (cachedChunk.hash == chunkInfo.hash) {
                    //load from localStorage when manifest hash equals to hash in localStorage
                    installedChunks[cachedChunk.chunkName] = ChunkWrap(cachedChunk.chunkName, cachedChunk.hash, new Function('return ' + cachedChunk.fn)());
                    util.log('load chunk ' + chunkName, ' from localStorage');
                    onLoad.call({});
                    continue;
                }
            }
            var head = document.getElementsByTagName('head')[0];
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.charset = 'utf-8';
            script.async = true;
            script.onload = onLoad;
            script.src = [publicPath, chunkInfo.fileName].join('');
            util.log('load chunk ' + chunkName + ' from network');
            head.appendChild(script);
        }
    };

    //when save localStorage,key with prefix
    function saveChunkToCache(cache) {
        var key = cachePrefix + cache.chunkName;
        try {
            //for some ios problem remove key before set
            localStorage.removeItem(key);
            localStorage.setItem(key, JSON.stringify(cache));
        } catch (e) {
            //catch some error 
            util.log('save localStorage exception ', e);
            if (util.isFunction(reporter.error)) {
                //report save to localStorage error;
                reporter.error('cache chunk error ', e.message);
            }
        }
    }
    function loadChunkFromCacahe(chunkName) {
        try {
            return localStorage.getItem(cachePrefix + chunkName);
        } catch (e) {
            return null;
        }
    }
    function ChunkWrap(chunkName, hash, fn) {
        return {
            chunkName: chunkName,
            hash: hash,
            fn: fn,
            executed: false
        }
    }
})(window);

