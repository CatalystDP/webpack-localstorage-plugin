'use strict';
//combo server 例子
const http = require('http');
const yargs = require('yargs');
const path = require('path');
const fs = require('fs');
let server = http.createServer();

server.on('request', (req, res) => {
    console.log('req url ' + req.url);
    // return res.socket.destroy(); 
    if (req.url.indexOf('/combo') != -1) {
        res.writeHead('200',{
            'Access-Control-Allow-Origin':'*'
        });
        let fileNames = req.url.match(/\/combo\/\=(.+)/);
        if (fileNames && fileNames[1]) {
            let files = fileNames[1].split(',');
            files.forEach((file) => {
                console.log(file);
                let _f=path.join(process.cwd(),file);
                if (fs.existsSync(_f)) {
                    res.write(fs.readFileSync(_f));
                }
            });
        }
        res.end();
    } else {
        res.writeHead('403','Forbidden')
        res.end('only use for combo');
    }
});

server.listen(~~yargs.argv.port);