import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Game} from './game.js';

export async function createGameServer({production=false,duration,now,random}={}){
  const app=express(),http=createServer(app);
  const io=new Server(http,{maxHttpBufferSize:8192,pingInterval:5000,pingTimeout:7000,serveClient:false});
  const game=new Game((target,event,data)=>io.to(target).emit(event,data),{duration,now,random});
  app.get('/health',(_,res)=>res.json({ok:true,rooms:game.rooms.size}));
  io.on('connection',socket=>{
    let count=0,window=Date.now();
    socket.use((_,next)=>{if(Date.now()-window>1000){window=Date.now();count=0;}if(++count>150){socket.disconnect(true);return;}next();});
    const handle=(event,fn)=>socket.on(event,async(data,ack)=>{
      try{const result=await fn(data);if(typeof ack==='function')ack({ok:true,...result});}
      catch(e){if(typeof ack==='function')ack({ok:false,error:e.message});}
    });
    handle('create',async data=>{const r=game.enter(socket.id,data?.name,undefined,{mapId:data?.mapId,playerLimit:data?.playerLimit});await socket.join(r.code);game.broadcast(r);return {code:r.code};});
    handle('join',async data=>{const r=game.enter(socket.id,data?.name,data?.code??'');await socket.join(r.code);game.broadcast(r);return {code:r.code};});
    handle('choose',data=>game.choose(socket.id,data));
    handle('configure',data=>game.configure(socket.id,data));
    handle('start',()=>game.start(socket.id));
    handle('return',()=>game.returnRoom(socket.id));
    handle('leave',async()=>{const code=game.members.get(socket.id);game.leave(socket.id);if(code)await socket.leave(code);});
    socket.on('input',data=>game.input(socket.id,data));
    socket.on('action',data=>{if(data&&typeof data.type==='string')game.action(socket.id,data.type,data.value);});
    socket.on('pingCheck',ack=>{if(typeof ack==='function')ack();});
    socket.on('disconnect',()=>game.leave(socket.id));
  });
  let tick=0;const loop=setInterval(()=>{game.tick();if(++tick%3===0)for(const r of game.rooms.values())if(r.state==='playing')game.snapshot(r);},1000/60);
  let vite;
  if(production){app.use(express.static(path.resolve('dist')));app.get('/',(_,res)=>res.sendFile(path.resolve('dist/index.html')));}
  else{const {createServer:createVite}=await import('vite');vite=await createVite({server:{middlewareMode:true,hmr:{server:http}},appType:'spa'});app.use(vite.middlewares);}
  return {http,io,game,close:async()=>{clearInterval(loop);await vite?.close();await new Promise(resolve=>io.close(resolve));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const server=await createGameServer({production:process.env.NODE_ENV==='production'});
  const port=Number(process.env.PORT)||3000;
  server.http.listen(port,'0.0.0.0',()=>console.log(`Crossline ready: http://localhost:${port}`));
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{await server.close();process.exit(0);});
}
