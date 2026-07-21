const menuButton=document.querySelector('[data-menu-button]');
const mobileMenu=document.querySelector('[data-mobile-menu]');
if(menuButton&&mobileMenu){menuButton.addEventListener('click',()=>mobileMenu.classList.toggle('open'));mobileMenu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>mobileMenu.classList.remove('open')))}
const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
if(window.lucide)lucide.createIcons();
