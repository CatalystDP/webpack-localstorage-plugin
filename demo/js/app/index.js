require('../vendor/liba').sayHello();
require('../vendor/libb').sayHello();
window.runApp = function () {
    window.webpack_local_cache.loadChunks(['asyncLiba'], function (result) {
        console.log('load status ',result);
        // require.ensure([], function (require) {
        //     require('../mod/asyncLiba');
        // }, function () {

        // }, 'asyncLiba');
    });
};