const {test}=require('node:test');const assert=require('node:assert/strict');const {harness,nodes}=require('./ui-harness.cjs');
test('startup rotation/loading stop with Reduce Motion and error recovery remains available',()=>{
  let motion=true,starts=0,stops=0,retries=0;const loops=[];
  class Value{constructor(v){this.value=v;}setValue(v){this.value=v;}interpolate(v){return v.outputRange[0];}}
  const ui=harness('src/Startup.js',['Startup'],{StartupArtwork:'StartupArtwork',StartupBackdrop:'StartupBackdrop',useMotionAllowed:()=>motion,useSafeAreaInsets:()=>({top:24,bottom:24}),useWindowDimensions:()=>({width:393,height:852}),useColorScheme:()=> 'light',Easing:{linear:()=>{}},Animated:{Value,View:'AnimatedView',timing:()=>({}),sequence:()=>({}),loop:()=>({start(){starts++;},stop(){stops++;}})}});
  const props={c:{accent:'#7353BB'},onRetry:()=>retries++};let tree=ui.render('Startup',props);ui.effects();assert.equal(starts,2);assert(nodes(tree).find(n=>n.props.accessibilityRole==='progressbar'));
  motion=false;tree=ui.render('Startup',props);ui.effects();assert.equal(starts,2);assert.equal(stops,2);
  tree=ui.render('Startup',{...props,error:'Initialization failed'});ui.effects();assert(!nodes(tree).some(n=>n.props.accessibilityRole==='progressbar'));
  nodes(tree).find(n=>n.type==='Pressable').props.onPress();assert.equal(retries,1);
});
