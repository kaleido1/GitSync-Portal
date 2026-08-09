(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>esc(v).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*\*([^*]+)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
const arr=v=>Array.isArray(v)?v:[];
const clone=v=>JSON.parse(JSON.stringify(v));
function loadState(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
function saveState(key,state){try{localStorage.setItem(key,JSON.stringify(state))}catch{}}
function parseBlock(code){const value=jsyaml.load(code)||{};return value.quiz||value}
function fieldName(q){return `quiz-${q.id}`}
function renderQuestion(q,state,submitted){
 const value=state.answers?.[q.id];let input='';const disabled=submitted?' disabled':'';
 if(q.type==='multiple-choice'||q.type==='true-false'){
  const options=q.type==='true-false'?[{id:'true',text:'True'},{id:'false',text:'False'}]:arr(q.options);
  input=options.map(o=>`<label><input type="radio" name="${esc(fieldName(q))}" value="${esc(o.id)}"${String(value)===String(o.id)?' checked':''}${disabled}>${fmt(o.text)}</label>`).join('');
 }else if(q.type==='multiple-select'){
  input=arr(q.options).map(o=>`<label><input type="checkbox" name="${esc(fieldName(q))}" value="${esc(o.id)}"${arr(value).map(String).includes(String(o.id))?' checked':''}${disabled}>${fmt(o.text)}</label>`).join('');
 }else if(q.type==='short-text'||q.type==='numeric'){
  input=`<input name="${esc(fieldName(q))}" type="${q.type==='numeric'?'number':'text'}" value="${esc(value??'')}"${disabled}>`;
 }else if(q.type==='matching'){
  input=arr(q.prompts).map(p=>`<label>${fmt(p.text)} <select name="${esc(fieldName(q))}" data-prompt="${esc(p.id)}"${disabled}><option value="">—</option>${arr(q.choices).map(c=>`<option value="${esc(c.id)}"${value?.[p.id]===c.id?' selected':''}>${esc(c.text)}</option>`).join('')}</select></label>`).join('');
 }else if(q.type==='reorder'){
  const order=arr(value).length?arr(value):arr(q.items).map(i=>i.id);const byId=Object.fromEntries(arr(q.items).map(i=>[i.id,i]));
  input=`<div class="quiz-order" data-name="${esc(fieldName(q))}">${order.map((id,i)=>`<div class="quiz-order-row" data-id="${esc(id)}"><span>${i+1}. ${fmt(byId[id]?.text??id)}</span><button type="button" data-move="up"${i===0||submitted?' disabled':''}>▲</button><button type="button" data-move="down"${i===order.length-1||submitted?' disabled':''}>▼</button></div>`).join('')}</div>`;
 }else input=`<div class="quiz-error">Unsupported question type: ${esc(q.type)}</div>`;
 const result=submitted?scoreQuestion(q,value):null;
 const feedback=submitted?`<div class="quiz-feedback ${result.ratio===1?'quiz-correct':'quiz-wrong'}">${result.ratio===1?'正确':'未完全正确'}${q.explanation?` — ${fmt(q.explanation)}`:''}</div>`:'';
 return `<section class="quiz-question" data-qid="${esc(q.id)}"><strong>${fmt(q.prompt)}</strong>${input}${feedback}</section>`;
}
function scoreQuestion(q,v){
 let ratio=0;
 if(q.type==='multiple-choice'||q.type==='true-false') ratio=String(v)===String(q.correctAnswer)?1:0;
 else if(q.type==='multiple-select'){
  const a=new Set(arr(v).map(String)),c=new Set(arr(q.correctAnswers).map(String));
  if(q.scoring==='partial'){const good=[...a].filter(x=>c.has(x)).length,bad=[...a].filter(x=>!c.has(x)).length;ratio=Math.max(0,(good-bad)/Math.max(1,c.size))}else ratio=a.size===c.size&&[...a].every(x=>c.has(x))?1:0;
 }else if(q.type==='short-text'){const input=String(v??'');ratio=arr(q.acceptedAnswers).some(a=>(q.caseSensitive?input:String(input).toLowerCase()).trim()===(q.caseSensitive?String(a):String(a).toLowerCase()).trim())?1:0}
 else if(q.type==='numeric') ratio=Math.abs(Number(v)-Number(q.correctAnswer))<=Number(q.tolerance||0)?1:0;
 else if(q.type==='reorder') ratio=JSON.stringify(arr(v))===JSON.stringify(arr(q.correctOrder))?1:0;
 else if(q.type==='matching'){const entries=Object.entries(q.correctMatches||{});ratio=entries.length?entries.filter(([k,x])=>v?.[k]===x).length/entries.length:0}
 return {ratio,points:Number(q.points||1)*ratio,total:Number(q.points||1)};
}
function collect(card,quiz,state){
 const answers={...(state.answers||{})};arr(quiz.questions).forEach(q=>{
  const name=fieldName(q);
  if(q.type==='multiple-choice'||q.type==='true-false') answers[q.id]=card.querySelector(`input[name="${CSS.escape(name)}"]:checked`)?.value;
  else if(q.type==='multiple-select') answers[q.id]=[...card.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map(x=>x.value);
  else if(q.type==='short-text'||q.type==='numeric') answers[q.id]=card.querySelector(`[name="${CSS.escape(name)}"]`)?.value;
  else if(q.type==='matching'){answers[q.id]={};card.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach(x=>answers[q.id][x.dataset.prompt]=x.value)}
  else if(q.type==='reorder') answers[q.id]=[...card.querySelectorAll(`[data-name="${CSS.escape(name)}"] [data-id]`)].map(x=>x.dataset.id);
 });state.answers=answers;
}
function mount(host,quiz,noteKey){
 if(!quiz?.id||!arr(quiz.questions).length)throw new Error('Quiz requires an id and questions.');
 const key=`quizzable:${noteKey}:${quiz.id}`,state=loadState(key);state.page=Number(state.page||0);
 const draw=()=>{
  const qs=arr(quiz.questions),one=quiz.mode!=='all-at-once',visible=one?[qs[Math.min(state.page,qs.length-1)]]:qs;
  let result='';if(state.submitted){const scores=qs.map(q=>scoreQuestion(q,state.answers?.[q.id])),score=scores.reduce((n,x)=>n+x.points,0),total=scores.reduce((n,x)=>n+x.total,0),pct=total?Math.round(score/total*100):0,passed=quiz.passingScore==null?'':pct>=Number(quiz.passingScore)?' · 通过':' · 未通过';result=`<div class="quiz-result">得分 ${score.toFixed(1)}/${total}（${pct}%）${passed}</div>`}
  host.innerHTML=`<div class="quiz-card"><h3>${fmt(quiz.title)}</h3>${quiz.description?`<div class="quiz-description">${fmt(quiz.description)}</div>`:''}${result}${visible.map(q=>renderQuestion(q,state,!!state.submitted)).join('')}<div class="quiz-nav">${one?`<button data-act="prev"${state.page<=0?' disabled':''}>上一题</button><span>${state.page+1}/${qs.length}</span><button data-act="next"${state.page>=qs.length-1?' disabled':''}>下一题</button>`:''}</div><div class="quiz-actions"><button data-act="submit">提交</button><button data-act="retry">重新作答</button></div></div>`;
  const card=host.firstElementChild;
  card.onchange=()=>{collect(card,quiz,state);if(quiz.persistAnswers!==false)saveState(key,state)};
  card.onclick=e=>{const move=e.target.dataset.move;if(move){const row=e.target.closest('[data-id]'),other=move==='up'?row.previousElementSibling:row.nextElementSibling;if(other)row.parentElement.insertBefore(move==='up'?row:other,move==='up'?other:row);collect(card,quiz,state);saveState(key,state);draw();return}const act=e.target.dataset.act;if(!act)return;collect(card,quiz,state);if(act==='prev')state.page=Math.max(0,state.page-1);if(act==='next')state.page=Math.min(qs.length-1,state.page+1);if(act==='submit')state.submitted=true;if(act==='retry'){state.answers={};state.submitted=false;state.page=0}saveState(key,state);draw()};
 };
 draw();
}
window.initQuizzable=(noteKey)=>{
 const definitions={};document.querySelectorAll('pre code.language-quiz').forEach(code=>{try{const q=parseBlock(code.textContent);if(q.id)definitions[q.id]=q;code.parentElement.hidden=true}catch(e){code.parentElement.outerHTML=`<div class="quiz-error">${esc(e.message)}</div>`}});
 document.querySelectorAll('pre code.language-playable-quiz').forEach(code=>{const pre=code.parentElement,host=document.createElement('div');pre.replaceWith(host);try{const raw=jsyaml.load(code.textContent)||{};const q=raw.quiz||(raw.id?definitions[raw.id]:raw.source==='current'?Object.values(definitions)[0]:raw);mount(host,clone(q),noteKey)}catch(e){host.innerHTML=`<div class="quiz-error">Quizzable: ${esc(e.message)}</div>`}});
};
})();
