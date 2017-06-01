'use strict';
const CACHE_FN_PREFIX = 'window.webpack_local_cache=window.webpack_local_cache||function(fn){fn()};' +
    'webpack_local_cache(function(){';//加上一些容错机制
const CACHE_FN_SUFFIX = '}';
const RawSource = require('webpack-sources/lib/RawSource');
class LocalStoragePlugin {
    constructor(option) {
        option = option || {};
        this.manifestName = option.manifestName || 'localCacheManifest.json';
        this.manifestFormat=option.manifestFormat||'json';
        this.manifestVariableName=option.manifestVariableName||"";
        this.ignoreChunks=option.ignoreChunks||[];
    }
    apply(compiler) {
        let self = this;
        compiler.plugin('emit', function (compilation, callback) {
            let assets = compilation.assets;
            let manifest = {};
            for (let name in compilation.namedChunks) {
                //only modify namedChunks
                let chunk = compilation.namedChunks[name];
                if (self.ignoreChunks.indexOf(chunk.name) == -1) {
                    //wrap chunk which is not in ignoreChunks
                    let outputOptions = compilation.compiler.options.output;
                    let fileName = outputOptions.chunkFilename || outputOptions.filename;
                    let file = compilation.mainTemplate.applyPluginsWaterfall('asset-path', fileName, {
                        chunk,
                        hash: chunk.renderedHash
                    })
                    manifest[chunk.name] = {
                        fileName: file,
                        hash: chunk.renderedHash
                    };
                    let targetSource = assets[file];
                    if (targetSource && typeof targetSource.source === 'function') {
                        //添加包装函数
                        let code = targetSource.source();
                        code = [
                            CACHE_FN_PREFIX,
                            code,
                            '\n',
                            CACHE_FN_SUFFIX,
                            `,${JSON.stringify(chunk.name)}`,
                            `,${JSON.stringify(chunk.renderedHash)}`,
                            ');'
                        ].join('')
                        assets[file]=new RawSource(code);
                    }
                }
            }
            let serializedManifest=JSON.stringify(manifest, null, '\t');
            if(self.manifestFormat==='js'){
                //output js as manifest and format like window.xxx={}
                if(!!self.manifestVariableName){
                    serializedManifest=`window.${self.manifestVariableName}=${serializedManifest}`;
                }
            }
            compilation.assets[self.manifestName] = new RawSource(serializedManifest);
            callback();
        })
    }
}
module.exports = LocalStoragePlugin;