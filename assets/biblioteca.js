(()=> {
  const grid=document.getElementById('character-grid');
  const input=document.getElementById('character-search');
  const count=document.getElementById('character-count');
  const empty=document.getElementById('empty-state');
  const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g,'');
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data=[],imageMap=new Map(),localPages={};
  const externalFicha=name=>'https://onepiece.fandom.com/wiki/'+encodeURIComponent(name.trim().replace(/ /g,'_'));
  function render(){
    const q=norm(input.value);
    const found=data.filter(x=>!q||norm(x.name).includes(q));
    count.textContent=found.length+' / '+data.length+' personagens';
    empty.hidden=found.length!==0;
    grid.innerHTML=found.map(x=>{
      const c=imageMap.get(norm(x.name));
      const initial='<span class="initial">'+esc(x.name.trim().charAt(0).toUpperCase())+'</span>';
      const image=c&&c.avatarSrc?'<img loading="lazy" src="'+esc(c.avatarSrc)+'" alt="'+esc(x.name)+'" onerror="this.remove()">'+initial:initial;
      const intro=c&&c.description?c.description:x.description||'Personagem do universo de One Piece.';
      const shortIntro=String(intro).replace(/\s+/g,' ').trim();
      const href=localPages[x.name]||externalFicha(x.name);
      return '<a class="character-card" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="Abrir ficha de '+esc(x.name)+' em nova aba"><div class="character-art">'+image+'</div><div class="character-copy"><span class="character-index">ARQUIVO #'+String(x.id).padStart(3,'0')+'</span><h3>'+esc(x.name)+'</h3><p>'+esc(shortIntro)+'</p><span class="card-open">Abrir ficha ↗</span></div></a>';
    }).join('');
  }
  async function loadCharacterImages(){
    const endpoint='https://onepieceql.up.railway.app/graphql';
    const query=page=>'{ characters(filter: {"page": '+page+'}) { info { pages } results { englishName avatarSrc description } } }';
    try{
      const first=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query(1)})});
      if(!first.ok)throw Error('API indisponível');
      const firstJson=await first.json();
      const firstData=firstJson.data&&firstJson.data.characters;
      if(!firstData)throw Error('Resposta inválida');
      const pages=Math.min(firstData.info&&firstData.info.pages||1,40);
      const rows=[...(firstData.results||[])];
      for(let start=2;start<=pages;start+=5){
        const batch=await Promise.all(Array.from({length:Math.min(5,pages-start+1)},(_,i)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query(start+i)})}).then(r=>r.ok?r.json():null).catch(()=>null)));
        batch.forEach(r=>{const chars=r&&r.data&&r.data.characters;if(chars&&chars.results)rows.push(...chars.results)});
      }
      rows.forEach(c=>{
        if(!c.englishName||!c.avatarSrc)return;
        c.englishName.split(';').forEach(alias=>{
          const key=norm(alias.replace(/\s*\([^)]*\)/g,'').trim());
          if(key&&!imageMap.has(key))imageMap.set(key,c);
        });
      });
      render();
    }catch(e){
      // Sem correspondência confirmada, mantém inicial em vez de exibir retrato errado.
    }
  }
  Promise.all([
    fetch('assets/characters-500.json').then(r=>{if(!r.ok)throw Error('data');return r.json()}),
    fetch('assets/character-pages.json').then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]).then(([x,pages])=>{
    data=x.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
    localPages=pages;
    render();
    loadCharacterImages();
  }).catch(()=>{
    count.textContent='Falha ao carregar o catálogo';
    empty.hidden=false;
    empty.textContent='Não foi possível carregar a biblioteca. Atualize a página.';
  });
  input.addEventListener('input',render);
})();