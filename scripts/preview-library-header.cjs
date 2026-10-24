// Code-rendered review states; this is not an Android screenshot or a frame-pacing test.
const fs=require('node:fs');
const {harness,nodes,h}=require('./ui-harness.cjs');
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const flat=s=>Array.isArray(s)?Object.assign({},...s.filter(Boolean).map(flat)):s||{};
function css(style){const values=flat(style), expanded={};for(const[k,v]of Object.entries(values)){if(/^(padding|margin)(Horizontal|Vertical)$/.test(k)){const base=k.startsWith('padding')?'padding':'margin';for(const side of k.endsWith('Horizontal')?['Left','Right']:['Top','Bottom'])expanded[base+side]=v;}else expanded[k]=v;}return Object.entries(expanded).map(([k,v])=>{
 if(k==='transform')return 'transform:'+v.map(t=>{const[a,b]=Object.entries(t)[0];return a+'('+b+(a.startsWith('translate')?'px':'')+')'}).join(' ')+';';
 if(k==='flex')return 'flex:'+v+' 1 0%;';
 return k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+v+(typeof v==='number'&&!['opacity','flexGrow','flexShrink','fontWeight','zIndex'].includes(k)?'px':'')+';';}).join('');}
const paths={search:'M21 21l-5-5 M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14', 'more-vertical':'M12 4v.01M12 12v.01M12 20v.01',sliders:'M6 3v18M18 3v18M3 8h6M15 16h6',play:'M7 4l14 8-14 8z','skip-forward':'M4 4l12 8-12 8zM20 4v16',music:'M9 18V5l12-2v13M9 5l12-2M6 21a3 3 0 1 0 0-6a3 3 0 1 0 0 6',list:'M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1',settings:'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3'};
let c;
function render(node){if(node===null||node===undefined||node===false)return '';if(typeof node!=='object')return escape(node);
 if(node.type==='HeaderOverlay'){const ui=harness('src/Pastel.js',['HeaderOverlay'],{useTheme:()=>c});return render(ui.render('HeaderOverlay'));}
 if(node.type==='Feather'||node.type==='Icon')return `<svg width="${node.props.size||22}" height="${node.props.size||22}" viewBox="0 0 24 24" fill="none" stroke="${node.props.color||c.ink}" stroke-width="2" stroke-linecap="round" style="flex-shrink:0"><path d="${paths[node.props.name]||paths.sliders}"/></svg>`;
 if(node.type==='Artwork'){const art=harness('src/Pastel.js',['FallbackArt'],{useTheme:()=>c,Svg:'svg',Rect:'rect',Circle:'circle',Path:'path'});return `<div style="width:${node.props.size||52}px;height:${node.props.size||52}px;flex-shrink:0;border-radius:11px;overflow:hidden">${render(art.render('FallbackArt',{size:node.props.size||52,seed:node.props.song?.albumId||0}))}</div>`;}
 const {style:rawStyle,...props}=node.props;let style=typeof rawStyle==='function'?rawStyle({pressed:false}):rawStyle;
 const svg=['svg','rect','circle','path'].includes(node.type),input=node.type==='TextInput',text=node.type==='Text';
 const tag=svg?node.type:input?'input':text?'span':'div';
 let inline=(svg?'':input?'box-sizing:border-box;border:0;background:transparent;font:inherit;outline:none;':text?'display:block;':'display:flex;flex-direction:column;flex-shrink:0;position:relative;box-sizing:border-box;border-style:solid;border-width:0;')+css(style);
 if(text&&props.numberOfLines===1)inline+='white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
 const attrs=svg?Object.entries(props).filter(([k])=>!['key','accessible'].includes(k)).map(([k,v])=>`${k.replace('strokeOpacity','stroke-opacity').replace('strokeWidth','stroke-width')}="${escape(v)}"`).join(' '):input?`placeholder="${escape(props.placeholder)}" value="${escape(props.value||'')}"`:'';
 return `<${tag} ${attrs} style="${inline}">${node.children.map(render).join('')}</${tag}>`;}
(async()=>{
 const browse=await import('../src/browse.js'),nav=await import('../src/navigation.js');
 const {palette,tones}=await import('../src/design.js');
 const {createLibraryIndex}=await import('../src/libraryIndex.js'),{formatTime}=await import('../src/music.js');
 const cards=[];
 for(const [dark,mode]of [[false,'visible'],[true,'visible'],[true,'down'],[true,'up']]){
  c=palette(dark);const state={queue:[],favorites:[],recent:[],playlists:{},sort:'Title',current:null,sound:{}};
  const ui=harness('App.js',['MusicApp','makeStyles'],{...browse,...nav,createLibraryIndex,formatTime,palette,tones,useTheme:()=>c,Native:{},useMusicSlice:()=>state,useStableCallback:f=>f,useAppActive:()=>true,useStatusPolling(){},useWindowDimensions:()=>({width:393,height:852,fontScale:1}),Platform:{OS:'android',Version:36},PermissionsAndroid:{PERMISSIONS:{}},Alert:{alert(){}}});
  ui.render('MusicApp');const permission=ui.slots.indexOf(false),ready=ui.slots.indexOf(false,permission+1);ui.slots[permission]=ui.slots[ready]=true;
  const titles=['Aaj Ki Raat','Amar Sonar Bangla','Bhorer Alo','Chand Sifarish','Durga Puja Special','Ekla Cholo Re','Kesariya','Phir Le Aaya Dil','Shiv Tandav Stotram','Tumi Robe Nirobe'];
  ui.slots[ui.slots.findIndex(Array.isArray)]=titles.map((title,i)=>({id:i+1,title,artist:['Arijit Singh','Rabindra Sangeet','Various artists'][i%3],album:'Favourites',folder:'/storage/emulated/0/Music',path:'/storage/emulated/0/Music/'+i+'.mp3',albumId:i,duration:240000}));
  const tree=ui.render('MusicApp'),list=nodes(tree).find(n=>n.type==='IndexedSongList');
  const header=nodes(tree).find(n=>n.props.testID==='browse-page-header');
  const rowUI=harness('src/SongRow.js',['SongRow'],{formatTime,Icon:'Icon'});
  const items=list.props.data.slice(mode==='visible'?0:3).map((item,index)=>{const row=list.props.renderItem({item,index});return render(rowUI.render('SongRow',row.props));}).join('');
  const label=(dark?'Dark':'Light')+' · '+(mode==='down'?'Scrolling down':mode==='up'?'Scrolling up':'Search visible');
  const search=mode==='down'?'':`<div style="padding:12px 0;border-bottom:1px solid ${c.headerLine};background:${c.bg}">${render(list.props.header)}</div>`;
  cards.push(`<article><h3>${label}</h3><div class="phone" style="background:${c.bg};color:${c.ink}"><div style="padding:10px 22px;font-size:13px;background:${c.header};color:${c.ink}">9:41<span style="float:right">▮▮▮  92%</span></div>${render(header)}${search}<div class="tracks">${mode==='visible'?render(list.props.prelude):''}<div style="padding:4px 14px">${items}</div></div><div style="height:70px;background:${c.card};border-top:1px solid ${c.line};display:flex;align-items:center;justify-content:space-around;color:${c.muted}"><span style="color:${c.accent};font-weight:700">♫ Library</span><span>Playlists</span><span>Sound</span><span>Settings</span></div></div></article>`);
 }
 fs.writeFileSync(process.argv[2] || '/tmp/aiplayed-header-review.html',`<!doctype html><meta charset="utf-8"><title>Header review</title><style>body{margin:0;padding:24px;background:#d4d9d7;color:#26342f;font:15px system-ui}main{display:flex;gap:18px}article{width:360px}h3{font-size:15px;font-weight:600;margin:0 0 12px}.phone{height:700px;border:1px solid #748a80;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 24px #1c312219}.tracks{flex:1;min-height:0;overflow:hidden}input::placeholder{color:#858594;opacity:1}</style><main>${cards.join('')}</main>`);
})();
