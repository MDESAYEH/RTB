import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'};
http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';const target=path.resolve(root,relative);if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});}).listen(3030,'127.0.0.1',()=>console.log('Isolated visual prototype http://127.0.0.1:3030'));
