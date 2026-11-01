import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "flower_shop_demo_secret_key_2026_change_me_32chars";

if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET должен содержать не менее 32 символов.");
}

type User = { id: number; name: string; email: string; passwordHash: string; role: "customer" };
type PublicUser = { id: number; name: string; email: string; role: string };
type Product = { id: number; name: string; description: string; price: number; category: string; imageUrl: string; stock: number; isActive: boolean };
type OrderItem = { productId: number; quantity: number };
type Order = {
  id: number; orderNumber: string; customerName: string; email: string; phone: string;
  deliveryMethod: string; deliveryAddress: string; items: Array<{productId:number; name:string; quantity:number; price:number}>;
  totalAmount: number; status: string; createdAt: string;
};
type AuthRequest = Request & { user?: PublicUser };

const dataDir = path.join(__dirname, "..", "data");
const usersFile = path.join(dataDir, "users.json");
const ordersFile = path.join(dataDir, "orders.json");
const productsFile = path.join(dataDir, "products.json");

function ensureFile(file: string, initial: unknown[] = []): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf8");
}
function readJson<T>(file: string): T {
  ensureFile(file);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
function writeJson<T>(file: string, value: T): void {
  ensureFile(file);
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temp, file);
}
function publicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
function makeToken(user: PublicUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "2h" });
}
function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ message: "Для этого действия необходимо войти в аккаунт." });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & PublicUser;
    req.user = { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ message: "Сеанс истёк. Войдите в аккаунт ещё раз." });
  }
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "OK", storage: "JSON files", database: false });
});

app.get("/api/categories", (_req: Request, res: Response) => {
  const products = readJson<Product[]>(productsFile);
  const categories = [...new Set(products.filter(p => p.isActive).map(p => p.category))].sort();
  res.json(categories.map((name, index) => ({ id: index + 1, name })));
});

app.get("/api/products", (req: Request, res: Response) => {
  const search = String(req.query.search || "").toLocaleLowerCase("ru");
  const category = String(req.query.category || "");
  const products = readJson<Product[]>(productsFile)
    .filter(p => p.isActive)
    .filter(p => !search || `${p.name} ${p.description}`.toLocaleLowerCase("ru").includes(search))
    .filter(p => !category || p.category === category);
  res.json(products);
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (name.length < 2 || name.length > 100) {
    res.status(400).json({ message: "Имя должно содержать от 2 до 100 символов." }); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: "Введите корректный email." }); return;
  }
  if (password.length < 8 || password.length > 72) {
    res.status(400).json({ message: "Пароль должен содержать от 8 до 72 символов." }); return;
  }
  const users = readJson<User[]>(usersFile);
  if (users.some(u => u.email === email)) {
    res.status(409).json({ message: "Пользователь с таким email уже зарегистрирован." }); return;
  }
  const user: User = {
    id: users.reduce((max, u) => Math.max(max, u.id), 0) + 1,
    name, email, passwordHash: await bcrypt.hash(password, 12), role: "customer"
  };
  users.push(user);
  writeJson(usersFile, users);
  const safe = publicUser(user);
  res.status(201).json({ message: "Регистрация прошла успешно!", token: makeToken(safe), user: safe });
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const users = readJson<User[]>(usersFile);
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: "Неверный email или пароль." }); return;
  }
  const safe = publicUser(user);
  res.json({ message: "Вы успешно вошли!", token: makeToken(safe), user: safe });
});

app.get("/api/auth/me", authenticate, (req: AuthRequest, res: Response) => {
  const user = readJson<User[]>(usersFile).find(u => u.id === req.user!.id);
  if (!user) { res.status(404).json({ message: "Пользователь не найден." }); return; }
  res.json({ user: publicUser(user) });
});

app.post("/api/orders", (req: Request, res: Response) => {
  const { customerName, email, phone, deliveryAddress, deliveryMethod, items } = req.body || {};
  if (!customerName || !email || !phone || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "Заполните контактные данные и добавьте товары в корзину." }); return;
  }
  if (!["delivery", "pickup"].includes(deliveryMethod)) {
    res.status(400).json({ message: "Выберите способ получения заказа." }); return;
  }
  if (deliveryMethod === "delivery" && !deliveryAddress) {
    res.status(400).json({ message: "Укажите адрес доставки." }); return;
  }

  const products = readJson<Product[]>(productsFile);
  const verified: Array<{productId:number; name:string; quantity:number; price:number}> = [];
  for (const item of items as OrderItem[]) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ message: "Некорректный товар в заказе." }); return;
    }
    const product = products.find(p => p.id === productId && p.isActive);
    if (!product) { res.status(400).json({ message: "Один из товаров больше недоступен." }); return; }
    if (product.stock < quantity) { res.status(400).json({ message: `Недостаточно товара «${product.name}» на складе.` }); return; }
    verified.push({ productId, name: product.name, quantity, price: product.price });
  }

  for (const item of verified) {
    const product = products.find(p => p.id === item.productId)!;
    product.stock -= item.quantity;
  }
  writeJson(productsFile, products);

  const orders = readJson<Order[]>(ordersFile);
  const orderId = orders.reduce((max, order) => Math.max(max, order.id), 0) + 1;
  const order: Order = {
    id: orderId,
    orderNumber: `FS-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${String(orderId).padStart(4,"0")}`,
    customerName: String(customerName).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    deliveryMethod,
    deliveryAddress: String(deliveryAddress || ""),
    items: verified,
    totalAmount: Number(verified.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)),
    status: "Новый",
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  writeJson(ordersFile, orders);
  res.status(201).json({ message: "Заказ успешно оформлен!", orderNumber: order.orderNumber, totalAmount: order.totalAmount, status: order.status });
});

app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Flower Shop запущен: http://localhost:${PORT}`);
  console.log("Хранение данных: JSON-файлы в папке data (PostgreSQL не требуется).");
});
