const {app,BrowserWindow,Menu,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const smokeIndex=process.argv.indexOf('--smoke-test');
if(smokeIndex>=0)app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'amerika-office-smoke-')));
const OFFICE='https://amerikaoffice-production.up.railway.app';
const trusted=new Set([new URL(OFFICE).origin,'https://amerikadocs-production.up.railway.app']);
app.setName('Makk Office');app.setAppUserModelId('com.amerika.office');
if(process.platform==='linux')app.setDesktopName('amerika-office.desktop');
let window;
const external=url=>{try{if(new URL(url).protocol==='https:')shell.openExternal(url);}catch{}};
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(()=>{
  window=new BrowserWindow({width:1320,height:900,minWidth:800,minHeight:600,title:'Makk Office',backgroundColor:'#0e0e10',icon:path.join(__dirname,'assets/icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false}});
  window.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  window.webContents.on('will-navigate',(event,url)=>{try{if(!trusted.has(new URL(url).origin)){event.preventDefault();external(url);}}catch{event.preventDefault();}});
  window.webContents.setWindowOpenHandler(({url})=>{
   if(url==='about:blank')return {action:'allow',overrideBrowserWindowOptions:{show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}};
   external(url);return {action:'deny'};
  });
  window.webContents.on('did-create-window',popup=>{
   popup.webContents.on('will-navigate',(event,url)=>{event.preventDefault();external(url);popup.close();});
  });
  window.webContents.session.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:'Save document',defaultPath:path.join(app.getPath('downloads'),item.getFilename())}));
  const menu=[...(process.platform==='darwin'?[{label:'Makk Office',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'quit'}]}]:[]),{label:'File',submenu:[{label:'Your files',click:()=>window.loadURL(OFFICE)},{type:'separator'},{role:process.platform==='darwin'?'close':'quit'}]},{role:'editMenu'},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},{label:'Help',submenu:[{label:'Source & licenses',click:()=>external('https://github.com/danecohn/AmerikaOffice')},{label:'Amerika Social',click:()=>external('https://www.amerika.social')}]}];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  if(smokeIndex>=0){
   const timeout=setTimeout(()=>app.exit(1),45000);
   window.webContents.once('did-finish-load',async()=>{
    try{
     const title=await window.webContents.executeJavaScript('document.title');
     if(!title.includes('Makk Office'))throw Error('Office did not load');
     const image=await window.webContents.capturePage();
     fs.writeFileSync(process.argv[smokeIndex+1],image.toPNG());clearTimeout(timeout);app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
   });
  }
  window.loadURL(OFFICE);
  window.on('closed',()=>{window=null;});
 });
 app.on('window-all-closed',()=>app.quit());
}
