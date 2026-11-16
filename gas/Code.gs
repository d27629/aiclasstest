/**
 * 餃酌 JIAO ZHUO — 訂單接收 (Google Apps Script)
 * 綁定在「訂單 Google 試算表」，部署為網頁應用程式後，由網站 POST 訂單進來。
 * 價格一律以「商品」工作表為準，前端傳來的金額不被採信。
 */
const CONFIG = {
  SHEET_ORDERS: '訂單',
  SHEET_ITEMS: '訂單明細',
  SHEET_PRODUCTS: '商品',
  SHIPPING_FEE: 160,          // 宅配運費（與網站一致）
  DELIVERY_ONLY_IDS: ['gift50'], // 宅配僅限這些商品
  MAX_QTY: 99,
  MAX_LINES: 30,
  OWNER_EMAIL: '',            // 填入後，每筆新訂單會寄通知信給店家；留空則不寄
  SEND_CUSTOMER_EMAIL: true,  // 是否寄確認信給顧客（Gmail 每日寄信額度有限）
  STORE_NAME: '餃酌 JIAO ZHUO',
  TIMEZONE: 'Asia/Taipei'
};

const ORDER_HEADERS = ['訂單編號', '建立時間', '狀態', '姓名', '電話', 'Email', '取餐方式', '宅配地址', '備註', '商品摘要', '商品金額', '運費', '總額'];
const ITEM_HEADERS = ['訂單編號', '商品ID', '商品名稱', '單價', '數量', '小計'];
const PRODUCT_HEADERS = ['商品ID', '分類', '名稱', '單價', '上架'];
const SEED_PRODUCTS = [
  ['p1', '招牌鍋貼', '經典高麗菜鍋貼', 85, true],
  ['p2', '招牌鍋貼', '香濃韭菜鍋貼', 90, true],
  ['p3', '招牌鍋貼', '椒麻鮮肉鍋貼', 95, true],
  ['p4', '精選水餃', '鮮肉高麗菜水餃', 90, true],
  ['p5', '精選水餃', '韭黃鮮蝦水餃', 120, true],
  ['p6', '精選水餃', '紅油抄手', 105, true],
  ['p7', '湯品／飲料', '暖心酸辣湯', 50, true],
  ['p8', '湯品／飲料', '鮮菇蔬菜湯', 55, true],
  ['p9', '湯品／飲料', '冷泡烏龍茶', 40, true],
  ['p10', '經典小菜', '爽脆涼拌小黃瓜', 45, true],
  ['p11', '經典小菜', '香滷豆干', 45, true],
  ['p12', '經典小菜', '特製椒香小菜', 50, true],
  ['gift50', '冷凍禮盒', '招牌招財鍋貼禮盒 50 入', 499, true]
];

/** 第一次使用：在試算表編輯器手動執行一次，會建立三個工作表與表頭。 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, CONFIG.SHEET_ORDERS, ORDER_HEADERS);
  ensureSheet_(ss, CONFIG.SHEET_ITEMS, ITEM_HEADERS);
  const products = ensureSheet_(ss, CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS);
  if (products.getLastRow() < 2) {
    products.getRange(2, 1, SEED_PRODUCTS.length, PRODUCT_HEADERS.length).setValues(SEED_PRODUCTS);
  }
  ss.getSheetByName(CONFIG.SHEET_ORDERS).getRange('F:F').setNumberFormat('@');
  ss.getSheetByName(CONFIG.SHEET_ORDERS).getRange('E:E').setNumberFormat('@');
  SpreadsheetApp.flush();
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#efe5d6');
    sh.setFrozenRows(1);
  }
  return sh;
}

function doGet() {
  return json_({ ok: true, service: 'jiaozhuo-orders' });
}

function doPost(e) {
  let lock;
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // 蜜罐欄位：機器人才會填，假裝成功即可
    if (payload.website) return json_({ ok: true, orderId: 'JZ-IGNORED', total: 0 });

    const order = validate_(payload);
    lock = LockService.getScriptLock();
    lock.waitLock(20000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const priced = price_(ss, order);
    const orderId = nextOrderId_();
    const now = new Date();
    const summary = priced.lines.map(l => l.name + ' ×' + l.qty).join('、');

    ss.getSheetByName(CONFIG.SHEET_ORDERS).appendRow([
      orderId, now, '新訂單', safe_(order.name), safe_(order.phone), safe_(order.email),
      order.fulfillment, safe_(order.address), safe_(order.note), summary,
      priced.subtotal, priced.shipping, priced.total
    ]);
    const itemRows = priced.lines.map(l => [orderId, l.id, l.name, l.price, l.qty, l.price * l.qty]);
    const items = ss.getSheetByName(CONFIG.SHEET_ITEMS);
    items.getRange(items.getLastRow() + 1, 1, itemRows.length, ITEM_HEADERS.length).setValues(itemRows);
    SpreadsheetApp.flush();
    lock.releaseLock();
    lock = null;

    notify_(orderId, order, priced, summary);
    return json_({ ok: true, orderId: orderId, subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total });
  } catch (err) {
    if (lock) { try { lock.releaseLock(); } catch (_) {} }
    const known = err && err.userFacing;
    if (!known) console.error(err && err.stack || err);
    return json_({ ok: false, error: known ? err.message : '系統忙碌，請稍後再試' });
  }
}

function validate_(p) {
  const fail = msg => { const e = new Error(msg); e.userFacing = true; throw e; };
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const order = {
    name: str(p.name, 40),
    phone: str(p.phone, 20),
    email: str(p.email, 100),
    fulfillment: str(p.fulfillment, 10),
    address: str(p.address, 200),
    note: str(p.note, 200),
    items: Array.isArray(p.items) ? p.items : []
  };
  if (!order.name) fail('請填寫姓名');
  if (!/^[0-9+()\-\s]{8,20}$/.test(order.phone)) fail('電話格式不正確');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) fail('Email 格式不正確');
  if (['內用', '外帶', '宅配'].indexOf(order.fulfillment) < 0) fail('取餐方式不正確');
  if (order.fulfillment === '宅配' && !order.address) fail('宅配請填寫地址');
  if (order.fulfillment !== '宅配') order.address = '';
  if (!order.items.length) fail('購物車是空的');
  if (order.items.length > CONFIG.MAX_LINES) fail('商品項目過多');
  // 合併重複商品
  const merged = {};
  order.items.forEach(it => {
    const id = str(it && it.id, 30);
    const qty = Number(it && it.qty);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > CONFIG.MAX_QTY) fail('商品數量不正確');
    merged[id] = (merged[id] || 0) + qty;
    if (merged[id] > CONFIG.MAX_QTY) fail('單項商品最多 ' + CONFIG.MAX_QTY + ' 份');
  });
  order.items = Object.keys(merged).map(id => ({ id: id, qty: merged[id] }));
  return order;
}

function price_(ss, order) {
  const fail = msg => { const e = new Error(msg); e.userFacing = true; throw e; };
  const sh = ss.getSheetByName(CONFIG.SHEET_PRODUCTS);
  if (!sh) fail('尚未完成系統設定');
  const catalog = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) catalog[String(r[0])] = { name: String(r[2]), price: Number(r[3]), active: r[4] === true || String(r[4]).toUpperCase() === 'TRUE' };
  });
  const lines = order.items.map(it => {
    const p = catalog[it.id];
    if (!p || !p.active || !(p.price >= 0)) fail('商品「' + it.id + '」目前無法訂購');
    return { id: it.id, name: p.name, price: p.price, qty: it.qty };
  });
  if (order.fulfillment === '宅配' && lines.some(l => CONFIG.DELIVERY_ONLY_IDS.indexOf(l.id) < 0)) {
    fail('宅配僅提供冷凍禮盒，請移除其他餐點或改選內用／外帶');
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = order.fulfillment === '宅配' ? CONFIG.SHIPPING_FEE : 0;
  return { lines: lines, subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
}

function nextOrderId_() {
  const props = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd');
  const key = 'seq-' + day;
  const n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return 'JZ' + day + '-' + ('000' + n).slice(-4);
}

function notify_(orderId, order, priced, summary) {
  const lines = [
    '訂單編號：' + orderId,
    '取餐方式：' + order.fulfillment + (order.address ? '（' + order.address + '）' : ''),
    '商品：' + summary,
    '商品金額：NT$ ' + priced.subtotal,
    '運費：NT$ ' + priced.shipping,
    '總額：NT$ ' + priced.total
  ];
  try {
    if (CONFIG.OWNER_EMAIL) {
      MailApp.sendEmail(CONFIG.OWNER_EMAIL, '【新訂單】' + orderId,
        lines.concat(['', '姓名：' + order.name, '電話：' + order.phone, 'Email：' + order.email, '備註：' + (order.note || '無')]).join('\n'));
    }
    if (CONFIG.SEND_CUSTOMER_EMAIL) {
      MailApp.sendEmail(order.email, '【' + CONFIG.STORE_NAME + '】已收到您的訂單 ' + orderId,
        order.name + ' 您好，\n\n我們已收到您的訂單，將盡快與您確認。\n\n' + lines.join('\n') + '\n\n（目前尚未線上付款，付款方式將於確認時說明。）\n' + CONFIG.STORE_NAME,
        { name: CONFIG.STORE_NAME });
    }
  } catch (err) {
    console.error('通知信寄送失敗：' + err); // 寄信失敗不影響訂單成立
  }
}

/** 避免試算表公式注入：以 = + - @ 開頭的文字加上單引號 */
function safe_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
