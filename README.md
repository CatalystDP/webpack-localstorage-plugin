
### webpack 插件实现localstorage缓存js

#### 0x01 

##### 移动端由于一些webview的坑，只依赖浏览器自有的缓存是不可靠的，例如ios上的webview的缓存是内存缓存，进程杀掉后就释放了。微信等一些app的webview可能由终端自己实现了一些缓存策略导致webview发出304请求，在移动端有时也是比较慢的，因此在必要时需要引入一套localstorage方案来缓存js。

#### 0x02 使用方式

1. 复制localCacheHelper.js到工程目录下，并引入到html当中
	
	```
	   <script src="localCacheHelper.js"></script>  OR
	   <script>inline localCacheHelper.js</script>
	```
2. 在webpack.config.js引用lib目录下的LocalStoragePlugin

	```
	const LocalStoragePlugin=require('../lib/LocalStoragePlugin');
	
	//some webpack config
	plugins:[
		 new LocalStoragePlugin({
            ignoreChunks:['chunkName'],
            manifestName:'localcacheManifest.json',
            manifestFormat:'json'
        }),
	]
	```
3. 执行打包之后会在output的目录下多出一个localcacheManifest.json文件，里面记录了命名chunk的信息，格式如下：
	
	```
		{
			"chunkA": {
				"fileName": "js/chunkA.hashA.js",
				"hash": "hashA"
			},
			"chunkB": {
				"fileName": "js/chunkB.hashB.js",
				"hash": "hashB"
			}
		}
	```
    将如上manifest引入到html当中

	```
	window.localcacheManifest={
			"chunkA": {
				"fileName": "js/chunkA.hashA.js",
				"hash": "hashA"
			},
			"chunkB": {
				"fileName": "js/chunkB.hashB.js",
				"hash": "hashB"
			}
		};
	```

4. 配置localcacheHelper.js

	```
	window.webpack_local_cache.init({
  		publicPath:'../dist/',
  		manifest: window.localcacheManifest,
  		reporter:{
  			error:function(err){
                 console.log(err);
                }
       }
 	});
 	window.webpack_local_cache.
 	loadChunks(['vendor','app'],function(result){
                console.log('load result ',result);
                window.runApp();
            });
			
	``` 
这样处理之后就可以把js缓存到localstorage了。

5.其他

- 插件本身只处理命名的chunk，也就是只缓存有名字的chunk，entry chunk肯定是有名字的，对于异步的chunk，需要在require.ensure加上第三个参数。

- 在使用require.ensure的地方，外面需要套上一层

	```
    window.webpack_local_cache.loadChunks(['asyncLib'], function(result) {
        console.log('load status ',result);
        require.ensure([], function (require) {
             require('path to async module');
        }, 'asyncLib');
    });
	```
  
  这样做的原理是require.ensure由webpack静态分析，编译出named async chunk，使得插件可以处理这个chunk，再由localcacheHelper去加载这个chunk并缓存。

#### 0x03 API

1. LocalStoragePlugin API
	
	`new LocalStoragePlugin(opt)`
	
	opt `{object}` 配置对象
	- opt.manifestName 生成的manifest文件名
	- opt.manifestFormat 生成格式`json|js`，default:`json`
	- opt.manifestVariableName 当`manifestFormat`为`js`时才有用，配置了这个之后生成的js文件内容为`window['mainfestVariableName']={}`;
	- opt.ignoreChunks `{array}` 忽略的chunk名称的数组

2. localcacheHelper.js API

	所有的api都在`webpack_local_cache`这个对象上
	- init(opt:object) 初始化helper
		- opt.manifest 插件生成的manifest对象
		- opt.publicPath 线上资源引用路径
		- opt.reporter `{object}` 上报对象
			- opt.reporter.error `{function}` 错误信息上报的函数
		- opt.cachePrefix localStorage key的前缀，默认使用当前页面路径作为前缀
		- opt.disableCache 传`true`时，不会使用localStorage当中的代码
		- opt.context 调用包装函数时的上下文，默认为`null`，有时需要传window，特别是在配合webpack dllPlugin时需要用到。
		- opt.disableLog 禁用log输出。
	- loadChunks(chunks:array,onLoadEnd:function)
		- chunks 需要加载的chunk列表，并且chunk也会按照这个顺序执行
		- onLoadEnd(result:object) 加载完成回调，并且会传入结果对象
			- result.status `success|fail`
			- result.failedChunks `array` 表示那些chunk没有正确加载
	- getConfigs 获取init时传入的配置对象
	- getInstalledChunks 获取已经加载的chunk
	