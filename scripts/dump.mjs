import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
const API='http://127.0.0.1:4000'; const DIST=path.join(process.cwd(),'web','dist-smoke'); const PORT=4997;
const html=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0]; if(u==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);} const f=path.join(DIST,u.slice(1)); if(fs.existsSync(f)){res.writeHead(200,{'Content-Type':u.endsWith('.css')?'text/css':'application/javascript'});return res.end(fs.readFileSync(f));} res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});
await new Promise(r=>server.listen(PORT,r));
const login=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@noor.iq',password:'admin123'})});
const {token}=await login.json();
const vc=new VirtualConsole(); vc.on('jsdomError',e=>{}); vc.on('error',(...a)=>console.log('ERR',...a));
const dom=await JSDOM.fromURL(`http://127.0.0.1:${PORT}/`,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.fetch=(i,init={})=>fetch(new URL(typeof i==='string'?i:'/',API),{...init,headers:{...(init.headers||{}),'x-session-token':token}});
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}); w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}}; w.scrollTo=()=>{};
 const rect=()=>({width:820,height:380,top:0,left:0,bottom:380,right:820,x:0,y:0,toJSON(){}}); w.Element.prototype.getBoundingClientRect=rect;
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get:()=>820}); Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get:()=>380}); w.print=()=>{};
}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); await sleep(2200);
for (const route of process.argv.slice(2)) {
  dom.window.history.pushState({},'',route); dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate')); await sleep(1800);
  console.log('\n===',route,'==='); const t=(dom.window.document.getElementById('root')?.textContent||'').replace(/\s+/g,' ').trim(); console.log('LEN', t.length); console.log('MAIN:', t.slice(600, 1500));
}
server.close(); process.exit(0);
