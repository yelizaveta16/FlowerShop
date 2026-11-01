const $ = (id) => document.getElementById(id);
const productGrid = $("productGrid");
const searchInput = $("searchInput");
const categorySelect = $("categorySelect");
const cartDrawer = $("cartDrawer");
const drawerBackdrop = $("drawerBackdrop");
const cartItemsElement = $("cartItems");
const cartCount = $("cartCount");
const cartTotal = $("cartTotal");
const checkoutForm = $("checkoutForm");
const checkoutMessage = $("checkoutMessage");
const authBackdrop = $("authBackdrop");
const authForm = $("authForm");
const authMessage = $("authMessage");
const accountOpen = $("accountOpen");
const nameField = $("nameField");
let authMode = "login", products = [], cart = JSON.parse(localStorage.getItem("flowerShopCart") || "[]");
let token = localStorage.getItem("flowerShopToken"), currentUser = null;
const money = value => `${Number(value).toFixed(2)} BYN`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

async function loadCategories() {
  const response = await fetch("/api/categories");
  const categories = await response.json();
  categorySelect.innerHTML = '<option value="">Все категории</option>' + categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
}
async function loadProducts() {
  productGrid.innerHTML = '<p class="loading">Загружаем цветы...</p>';
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (categorySelect.value) params.set("category", categorySelect.value);
  try {
    const response = await fetch(`/api/products?${params}`);
    if (!response.ok) throw new Error("Не удалось загрузить каталог");
    products = await response.json(); renderProducts(); renderCart();
  } catch (error) { productGrid.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}
function renderProducts() {
  if (!products.length) { productGrid.innerHTML = '<p class="empty-state">По вашему запросу ничего не найдено.</p>'; return; }
  productGrid.innerHTML = products.map(p => `<article class="product-card">
    <div class="product-image"><img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=700&q=80'"></div>
    <div class="product-info"><span class="product-category">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p>
    <div class="product-bottom"><span class="product-price">${money(p.price)}</span><button class="add-button" data-add="${p.id}" ${p.stock<1?"disabled":""}>${p.stock<1?"Нет в наличии":"В корзину +"}</button></div></div></article>`).join("");
}
function saveCart(){localStorage.setItem("flowerShopCart",JSON.stringify(cart));renderCart();}
function renderCart(){
  const rows=cart.map(i=>({...i,product:products.find(p=>p.id===i.productId)})).filter(i=>i.product);
  cartCount.textContent=rows.reduce((s,i)=>s+i.quantity,0);
  cartTotal.textContent=money(rows.reduce((s,i)=>s+Number(i.product.price)*i.quantity,0));
  if(!rows.length){cartItemsElement.innerHTML='<p class="empty-state">Корзина пока пуста. Выберите букет в каталоге.</p>';return;}
  cartItemsElement.innerHTML=rows.map(i=>`<div class="cart-row"><img src="${escapeHtml(i.product.imageUrl)}" alt=""><div><strong>${escapeHtml(i.product.name)}</strong><small>${money(i.product.price)}</small><div class="qty-controls"><button data-qty="${i.productId}" data-change="-1">−</button><span>${i.quantity}</span><button data-qty="${i.productId}" data-change="1">+</button></div></div><button class="remove-item" data-remove="${i.productId}">×</button></div>`).join("");
}
function openCart(){cartDrawer.classList.add("open");drawerBackdrop.classList.add("show");}
function closeCart(){cartDrawer.classList.remove("open");drawerBackdrop.classList.remove("show");}
function openAuth(){authBackdrop.classList.add("show");authMessage.textContent="";}
function closeAuth(){authBackdrop.classList.remove("show");}
function setAuthMode(mode){
  authMode=mode;nameField.hidden=mode!=="register";
  $("authTitle").textContent=mode==="register"?"Создать аккаунт":"Добро пожаловать";
  $("authSubmit").innerHTML=mode==="register"?'Зарегистрироваться <span>→</span>':'Войти в аккаунт <span>→</span>';
  authForm.elements.password.autocomplete=mode==="register"?"new-password":"current-password";
  document.querySelectorAll("[data-auth-mode]").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode));
  authMessage.textContent="";
}
function updateAccount(){accountOpen.textContent=currentUser?`Привет, ${currentUser.name} · Выйти`:"Войти";}
function applySession(data){
  token=data.token;currentUser=data.user;localStorage.setItem("flowerShopToken",token);updateAccount();
  checkoutForm.elements.customerName.value=currentUser.name;checkoutForm.elements.email.value=currentUser.email;
}
function logout(){token=null;currentUser=null;localStorage.removeItem("flowerShopToken");updateAccount();}
async function restoreSession(){
  if(!token)return;
  try{const r=await fetch("/api/auth/me",{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error();const d=await r.json();currentUser=d.user;updateAccount();checkoutForm.elements.customerName.value=currentUser.name;checkoutForm.elements.email.value=currentUser.email;}
  catch{logout();}
}

productGrid.addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;const id=Number(b.dataset.add),p=products.find(x=>x.id===id);if(!p)return;const row=cart.find(x=>x.productId===id);if(row)row.quantity++;else cart.push({productId:id,quantity:1});saveCart();});
cartItemsElement.addEventListener("click",e=>{
  const q=e.target.closest("[data-qty]"),r=e.target.closest("[data-remove]");
  if(q){const item=cart.find(x=>x.productId===Number(q.dataset.qty));if(item)item.quantity+=Number(q.dataset.change);cart=cart.filter(x=>x.quantity>0);saveCart();}
  if(r){cart=cart.filter(x=>x.productId!==Number(r.dataset.remove));saveCart();}
});
$("cartOpen").addEventListener("click",openCart);$("cartClose").addEventListener("click",closeCart);drawerBackdrop.addEventListener("click",closeCart);
let searchTimer;searchInput.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadProducts,250);});categorySelect.addEventListener("change",loadProducts);
$("deliveryMethod").addEventListener("change",e=>{$("deliveryAddress").required=e.target.value==="delivery";$("deliveryAddress").hidden=e.target.value==="pickup";});
accountOpen.addEventListener("click",()=>{if(currentUser){logout();}else{setAuthMode("login");openAuth();}});
$("authClose").addEventListener("click",closeAuth);authBackdrop.addEventListener("click",e=>{if(e.target===authBackdrop)closeAuth();});
document.querySelectorAll("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authMode)));
authForm.addEventListener("submit",async e=>{
  e.preventDefault();const payload=Object.fromEntries(new FormData(authForm).entries());
  const endpoint=authMode==="register"?"/api/auth/register":"/api/auth/login";
  $("authSubmit").disabled=true;authMessage.textContent="Пожалуйста, подождите...";
  try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.message||"Ошибка запроса");applySession(d);authMessage.className="form-message success";authMessage.textContent=d.message;authForm.reset();setTimeout(closeAuth,650);}
  catch(err){authMessage.className="form-message";authMessage.textContent=err.message||"Не удалось связаться с сервером.";}
  finally{$("authSubmit").disabled=false;}
});
checkoutForm.addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length){checkoutMessage.textContent="Добавьте товары в корзину.";return;}
  const payload=Object.fromEntries(new FormData(checkoutForm).entries());payload.items=cart.map(i=>({productId:i.productId,quantity:i.quantity}));
  checkoutMessage.textContent="Отправляем заказ...";
  try{const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.message||"Не удалось оформить заказ");checkoutMessage.className="form-message success";checkoutMessage.textContent=`${d.message} Номер: ${d.orderNumber}. Сумма: ${money(d.totalAmount)}.`;cart=[];saveCart();checkoutForm.reset();if(currentUser){checkoutForm.elements.customerName.value=currentUser.name;checkoutForm.elements.email.value=currentUser.email;}await loadProducts();}
  catch(err){checkoutMessage.className="form-message";checkoutMessage.textContent=err.message||"Ошибка соединения.";}
});
(async()=>{try{await Promise.all([loadCategories(),loadProducts()]);await restoreSession();renderCart();updateAccount();}catch(e){productGrid.innerHTML='<p class="empty-state">Не удалось загрузить сайт. Проверьте, запущен ли сервер.</p>';}})();
