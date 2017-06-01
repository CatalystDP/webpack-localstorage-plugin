require('../vendor/liba').sayHello();
require('../vendor/libb').sayHello();
window.runApp = function () {
    window.webpack_local_cache.loadChunks(['asyncLiba'], function () {
        require.ensure([], function (require) {
            require('../mod/asyncLiba');
        }, function () {

        }, 'asyncLiba');
    });
};