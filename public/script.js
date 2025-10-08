document.addEventListener('DOMContentLoaded', function(){
  const ham = document.getElementById('hamburger');
  const drawer = document.getElementById('drawer');
  ham && ham.addEventListener('click', function(){
    if (drawer.style.display === 'flex') drawer.style.display = 'none';
    else {
      drawer.innerHTML = document.querySelector('.nav').innerHTML;
      drawer.style.display = 'flex';
    }
  });

  const search = document.getElementById('search');
  if (search){
    search.addEventListener('input', function(){
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('.card').forEach(card=>{
        const title = (card.querySelector('.card-body') && card.querySelector('.card-body').innerText) || '';
        card.style.display = title.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
});
