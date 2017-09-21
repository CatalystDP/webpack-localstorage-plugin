(function (root) {
    var util = {
        is: function (obj, type) {
            return Object.prototype.toString.call(obj).replace(/\[|\]/g, '').substr(7).toLowerCase() === type;
        },
        isObject: function (obj) {
            return util.is(obj, 'object');
        },
        isArray: function (obj) {
            return util.is(obj, 'array');
        },
        isFunction: function (obj) {
            return util.is(obj, 'function');
        },
        log: function () {
            if (option && option.disableLog) return;
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
        'webpack_local_cache(';//加上一些容错机制
    var CACHE_FN_SUFFIX = ');';
    var cachePrefix = 'chunk_';
    var isInited = false, entryLoaded = false;
    var option, publicPath, manifestObj;
    var reporter;
    var installedChunks = {};
    root.webpack_local_cache = function (fn, chunkName, hash,fromCache) {
        var c = installedChunks[chunkName] = ChunkWrap(chunkName, hash, fn);
        if (option.disableCache) {
            //disable cache
            return;
        }
        if (!manifestObj[chunkName]) {
            return;
        }
        if(manifestObj[chunkName].hash!=hash){
            /**
             * 
             *if hash in manifest no equal to hash loaded from outside do not  *save to cache
             */
            util.log('load hash not equal to hash in manifest');
            return;
        }
        var cache = {
            chunkName: chunkName,
            hash: hash,
            fn: fn.toString()
        }
        if(!fromCache){
            util.log('save to cache');
            !fromCache && saveChunkToCache(cache);
        }
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
        opt = opt || {};
        option = opt;
        manifestObj = option.manifest || {};
        publicPath = opt.publicPath;
        opt.reporter = opt.reporter || {};
        reporter = opt.reporter;
        cachePrefix = option.cachePrefix || window.location.pathname;
        if (!util.isSupportLocalStorage()) {
            option.disableCache = true;//disable cache when localStorage is not support
        }
        if (!option.disableCache) {
            //clear cached chunk which are not in manifest
            for (var i = 0, len = localStorage.length; i < len; ++i) {
                try {
                    var key = localStorage.key(i);
                    if (key && key.indexOf && key.indexOf(cachePrefix) > -1) {
                        if (!manifestObj.hasOwnProperty(key.replace(cachePrefix, ''))) {
                            util.log('chunk ' + key.replace(cachePrefix, '') + ' will be removed');
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) { }
            }
        }
        isInited = true;
    };
    root.webpack_local_cache.getConfigs = function () {
        return option;
    };
    root.webpack_local_cache.getInstalledChunks = function () {
        return installedChunks;
    };
    root.webpack_local_cache.loadChunks = function (chunks, onLoadEnd) {
        if (!util.isArray(chunks)) return;
        var manifest = manifestObj || {};
        var len = chunks.length, count = 0;
        function onLoad(inc) {
            this.onload = null;
            // ++count;
            count += inc;
            if (count == len) {
                var failedChunks = [];
                chunks.forEach(function (chunk) {
                    var chunkName = util.isObject(chunk) ? chunk.chunkName : chunk;
                    var installedChunk = installedChunks[chunkName];
                    if (installedChunk && !installedChunk.executed) {
                        var flag = true;
                        if (util.isObject(chunk)) {
                            if (util.isObject(chunk.params)) {
                                if (chunk.params.lazy) {
                                    //delay exec 
                                    util.log('chunk ' + chunkName + ' is delay execute');
                                    flag = false;
                                }
                            }
                        }
                        if (flag) {
                            util.log('chunk ' + chunkName + ' will execute');
                            try {
                                util.isFunction(installedChunk.fn) && installedChunk.fn.call(option.context || null);//context in fn
                            } catch (e) {
                                if(opt.reporter){
                                    //report js exec error
                                    util.isFunction(opt.reporter.error) && opt.reporter.error('exec_js_error',e.message);
                                }
                            }
                            installedChunk.executed = true;
                        }
                    }
                    if (!installedChunk) {
                        //chunk load fail call reporter
                        failedChunks.push(chunkName);
                    }
                });
                var loadStatus = {
                    status: 'success'
                };
                if (failedChunks.length > 0) {
                    loadStatus.status = 'failed';
                    loadStatus.failedChunks = failedChunks;
                }
                util.isFunction(onLoadEnd) && onLoadEnd(loadStatus);
            }
        }
        var head = document.getElementsByTagName('head')[0];
        var comboArr = [], cacheChunkStr = '', cacheChunkCount = 0;
        for (var i = 0; i < len; ++i) {
            var chunkName = chunks[i];
            if (util.isObject(chunkName)) {
                chunkName = chunkName.chunkName;
            }
            var chunkInfo = manifest[chunkName];
            if (!chunkInfo) {
                onLoad.call({}, 1);
                continue;
            }
            if (installedChunks[chunkName]) {
                util.log('chunk ' + chunkName + ' is installed');
                onLoad.call({}, 1);
                continue;
            }
            var cachedChunk = loadChunkFromCacahe(chunkName);
            if (cachedChunk && !option.disableCache) {
                cachedChunk = JSON.parse(cachedChunk);
                if (cachedChunk.hash == chunkInfo.hash) {
                    //load from localStorage when manifest hash equals to hash in localStorage
                    if (option.reporter && util.isFunction(option.reporter.beforeLoadCache) && (option.reporter.beforeLoadCache.call(null, cachedChunk.chunkName)));
                    cacheChunkStr += '' + CACHE_FN_PREFIX + cachedChunk.fn + ",\"" + cachedChunk.chunkName + "\"," + "\"" + cachedChunk.hash + "\"" +",true" +CACHE_FN_SUFFIX + '\n';
                    ++cacheChunkCount;
                    if (option.reporter && util.isFunction(option.reporter.afterLoadCache) && (option.reporter.afterLoadCache.call(null, cachedChunk.chunkName)));
                    util.log('load chunk ' + chunkName, ' from localStorage');

                    continue;
                }
            }
            var url = [publicPath, chunkInfo.fileName].join('');
            if (!option.combo) {
                var method = option.useAjax ? createAjaxScript : createAsyncScript;
                var script = method(url, function () {
                    this.onload = null;
                    onLoad.call({}, 1);
                });
                util.log('load chunk ' + chunkName + ' from network');
                if (script) {
                    head.appendChild(script);
                }
            }
            else {
                comboArr.push(chunkInfo.fileName);
            }
        }
        if (option.combo && comboArr.length > 0 && util.isFunction(option.combo)) {
            var method = option.useAjax ? createAjaxScript : createAsyncScript;
            var script = method(option.combo.call(null, comboArr), function () {
                this.onload = null;
                onLoad.call({}, comboArr.length);//combo loaded and trigger exec
            });
            if (script) {
                head.appendChild(script);
            }
        }
        if (cacheChunkCount > 0) {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.charset = 'utf-8';
            script.innerHTML = cacheChunkStr;
            head.appendChild(script);
            onLoad.call({}, cacheChunkCount);
        }
    };

    //when save localStorage,key with prefix
    function saveChunkToCache(cache) {
        var key = cachePrefix + cache.chunkName;
        try {
            //for some ios problem remove key before se
            localStorage.removeItem(key);
            localStorage.setItem(key, JSON.stringify(cache));
        } catch (e) {
            //catch some error 
            util.log('save localStorage exception ', e);
            if (util.isFunction(reporter.error)) {
                //report save to localStorage error;
                reporter.error('cache_chunk_error ', e.message);
            }
        }
    }
    function loadChunkFromCacahe(chunkName) {
        try {
            return localStorage.getItem(cachePrefix + chunkName);
        } catch (e) {
            if (util.isFunction(reporter.error)) {
                //report load to localStorage error;
                reporter.error('cache_chunk_error ', e.message);
            }
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
    function createAsyncScript(url, onload) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.charset = 'utf-8';
        script.async = true;
        script.onload = onload;
        script.src = url;
        return script;
    }
    //onerror callback will be called when status
    function createAjaxScript(url, onload, onerror) {
        var ajax = new XMLHttpRequest();
        ajax.onreadystatechange = function () {
            if (ajax.readyState == 4) {
                if (ajax.status >= 200 && ajax.status < 300) {
                    var head = document.getElementsByTagName('head')[0];
                    var script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.charset = 'utf-8';
                    script.innerHTML = ajax.responseText;
                    head.appendChild(script);
                } else {
                    if (util.isFunction(option.reporter.error)) {
                        //report load js error;
                        //
                        option.reporter.error('js_load_fail', JSON.stringify({
                            status: ajax.status,
                            url: url
                        }));
                    }
                }
                onload.call({});
            }
        };
        //load fail
        ajax.onerror = function () {
            if (util.isFunction(onerror)) {
                onerror();
            }
            if (util.isFunction(option.reporter.error)) {
                //report load to localStorage error;
                option.reporter.error('js_load_fail', JSON.stringify({
                    status: 0,
                    url: url
                }));
            }
        };
        ajax.open('GET', url, true);
        ajax.send(null);
    }
})(window);

