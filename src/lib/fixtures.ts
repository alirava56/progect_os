import type { DemoData, Task } from './types';

export const demoDate = '2025-11-16';
const task = (id: string, title: string, projectId: string, status: Task['status'], priority: Task['priority'], day: number): Task => ({
  id, title, projectId, status, priority, owner: 'dev', due: `2025-11-${day}`,
  description: 'جزئیات این وظیفه را با تیم مرور کنید و نتیجهٔ بررسی را در یادداشت‌ها ثبت کنید.',
  checklist: [], comments: [], dependencies: [],
});
export const defaultData: DemoData = {
  projects: [
    { id: 'gym', name: 'باشگاه شب قهرمانان', coverTitle: 'Champions Night Gym', subtitle: 'وب‌سایت رزرو و پنل مدیریت', description: 'وب‌سایت باشگاه با سیستم رزرو، پنل کاربری و پنل مدیریت. منابع، تغییرات و برنامهٔ تحویل در یک مکان.', status: 'building', type: 'وب‌سایت', progress: 78, next: 'به‌روزرسانی رابط کاربری', art: 'navigation/projects' },
    { id: 'mokmok', name: 'MOKMOK', coverTitle: 'MOKMOK', subtitle: 'سامانه برنامه‌ریزی هوشمند تغذیه', description: 'فضای مشترک تیم توسعه برای مدیریت موتور قیمت‌گذاری، مستندات و برنامهٔ انتشار.', status: 'review', type: 'محصول نرم‌افزاری', progress: 63, next: 'موتور قیمت‌گذاری', art: 'infrastructure/architecture-layers' },
    { id: 'novaguard', name: 'NovaGuard', coverTitle: 'NovaGuard', subtitle: 'زیرساخت سرویس VPN', description: 'فضای ثبت منابع، وضعیت تمدیدها و راهنماهای نگهداری زیرساخت نمونه.', status: 'active', type: 'زیرساخت', progress: 92, next: 'کنترل تنظیمات سرور', art: 'navigation/vault' },
  ],
  tasks: [
    { ...task('TASK-024', 'رفع ناسازگاری رابط رزرو', 'gym', 'doing', 'high', 19), description: 'صفحهٔ انتخاب مربی، انتخاب روز و ساعت، بازخورد خطا و حالت نمایش رزرو باید در تمام اندازه‌های صفحه یکپارچه باشند.',
      checklist: [{label:'آزمون باز شدن فرم رزرو',checked:true},{label:'هماهنگی چینش فیلدها',checked:true},{label:'بازبینی انتخاب ساعت در موبایل',checked:false},{label:'تست حالت بدون ظرفیت',checked:false},{label:'تأیید نهایی مدیر پروژه',checked:false}],
      comments: [{text:'چیدمان اولیهٔ فرم با تیم طراحی مرور شد.',date:'2025-11-15'}], dependencies: ['TASK-025'] },
    task('TASK-025','بهبود متن‌های راهنما','gym','todo','medium',18),
    task('TASK-026','بررسی گزارش نهایی موتور قیمت','mokmok','doing','high',17),
    task('TASK-027','ثبت اطلاعات تمدید VPS','novaguard','todo','high',20),
    task('TASK-028','بازبینی طرح دیتابیس','gym','done','low',13),
    task('TASK-029','آزمون اتصال سرور جدید','novaguard','doing','medium',21),
    task('TASK-030','تست فرایند رزرو نسخه موبایل','gym','todo','medium',17),
    task('TASK-031','بهبود ظاهر کارت‌ها','mokmok','done','medium',15),
    task('TASK-032','ثبت مشخصات اولیه VPS','novaguard','done','low',14),
    task('TASK-033','تکمیل مستندات نصب','novaguard','todo','high',23),
    task('TASK-034','ثبت ظرفیت‌های سرویس','mokmok','todo','low',24),
    task('TASK-035','تأیید رزرو تکراری','gym','doing','high',23),
    task('TASK-036','بررسی متن ساختار فوتر','gym','todo','medium',25),
    task('TASK-037','ثبت نسخهٔ آزمایشی','mokmok','todo','low',26),
    task('TASK-038','بازبینی اعلان‌های سرویس','novaguard','todo','medium',27),
  ],
  resources: [
    { id:'nova-vps', name:'NovaGuard Main VPS', projectId:'novaguard', type:'server', address:'203.0.113.24', environment:'Production', status:'registered', provider:'Example Cloud', region:'فرانکفورت (نمونه)', os:'Ubuntu 24.04 LTS', port:22, tags:['VPS', 'Linux'] },
    { id:'gym-web', name:'Production Website', projectId:'gym', type:'service', address:'gym.example.com', environment:'Production', status:'registered', provider:'Example Hosting', tags:['HTTPS'] },
    { id:'mok-db', name:'MOKMOK DB', projectId:'mokmok', type:'database', address:'db.mokmok.example', environment:'Production', status:'registered', provider:'PostgreSQL', tags:['SQL'] },
    { id:'nova-domain', name:'NovaGuard Domain', projectId:'novaguard', type:'domain', address:'vpn.example.net', environment:'Production', status:'missing', provider:'Example DNS', parentId:'nova-vps', tags:['DNS'] },
    { id:'gym-repo', name:'Gym Repository', projectId:'gym', type:'service', address:'gym.example/repository', environment:'Development', status:'registered', provider:'GitHub', tags:['Git'] },
    { id:'nova-backup', name:'Backup Storage', projectId:'novaguard', type:'service', address:'backup.nova.example', environment:'Production', status:'review', provider:'Example Storage', parentId:'nova-vps', tags:['Backup'] },
    { id:'gym-vps', name:'Gym Staging VPS', projectId:'gym', type:'server', address:'192.0.2.18', environment:'Staging', status:'registered', provider:'Example Cloud', region:'آمستردام (نمونه)', os:'Ubuntu 24.04 LTS', port:22, expires:'2025-12-07', tags:['VPS'] },
    { id:'mok-vps', name:'MOKMOK Worker', projectId:'mokmok', type:'server', address:'198.51.100.11', environment:'Staging', status:'review', provider:'Example Cloud', os:'Debian 12', port:22, tags:['Worker'] },
    { id:'gym-db', name:'Gym PostgreSQL', projectId:'gym', type:'database', address:'db.gym.example', environment:'Production', status:'review', provider:'PostgreSQL', tags:['SQL'] },
    { id:'gym-domain', name:'Gym Domain', projectId:'gym', type:'domain', address:'gym.example.com', environment:'Production', status:'registered', provider:'Example DNS', tags:['DNS'] },
    { id:'mok-domain', name:'MOKMOK API Domain', projectId:'mokmok', type:'domain', address:'api.mokmok.example', environment:'Production', status:'registered', provider:'Example DNS', tags:['DNS'] },
    { id:'nova-status', name:'NovaGuard Status', projectId:'novaguard', type:'domain', address:'status.nova.example', environment:'Production', status:'registered', provider:'Example DNS', tags:['DNS'] },
  ],
  secrets: [
    {id:'sec-1',name:'NovaGuard Root SSH',type:'SSH Key',projectId:'novaguard',vaultProvider:'Infisical / Server Credentials'},
    {id:'sec-2',name:'NovaGuard Panel Admin',type:'Account',projectId:'novaguard',vaultProvider:'Vault / Services'},
    {id:'sec-3',name:'GitHub Token Reference',type:'API Token',projectId:'gym',vaultProvider:'Vault / Integrations',lastCheckedAt:'2025-11-14'},
    {id:'sec-4',name:'Production Database',type:'DB Credential',projectId:'mokmok',vaultProvider:'Vault / Database'},
    {id:'sec-5',name:'DNS Provider',type:'Account',projectId:'gym',vaultProvider:'Vault / Providers',lastCheckedAt:'2025-11-10'},
    {id:'sec-6',name:'Staging Access Reference',type:'SSH Key',projectId:'gym',vaultProvider:'Vault / Staging'},
  ],
  reminders: [
    {id:'r1',title:'مرور هفتگی پروژه‌ها',projectId:'gym',due:'2025-11-18',kind:'جلسه'},
    {id:'r2',title:'کنترل تاریخ تمدید VPS',projectId:'novaguard',due:'2025-11-20',kind:'تمدید'},
    {id:'r3',title:'بررسی داده محصولات',projectId:'mokmok',due:'2025-11-17',kind:'یادآوری'},
    {id:'r4',title:'جلسهٔ تحویل نسخه آزمایشی',projectId:'mokmok',due:'2025-11-13',kind:'جلسه'},
    {id:'r5',title:'تمدید دامنه باشگاه',projectId:'gym',due:'2025-12-06',kind:'تمدید'},
  ],
  incidents: [
    {id:'a1',title:'تاریخ تمدید سرور ثبت نشده',projectId:'novaguard',priority:'high',source:'اطلاعات زیرساخت',date:'2025-11-16',state:'open'},
    {id:'a2',title:'آخرین تست بازیابی Backup نامشخص است',projectId:'gym',priority:'high',source:'امنیت داده',date:'2025-11-15',state:'open'},
    {id:'a3',title:'مستندات محیط Production ناقص است',projectId:'mokmok',priority:'medium',source:'مستندات',date:'2025-11-14',state:'open'},
    {id:'a4',title:'تست تأیید رابط کاربری باز مانده',projectId:'gym',priority:'medium',source:'مدیریت کار',date:'2025-11-12',state:'open'},
    {id:'a5',title:'بازبینی گواهی دامنه انجام شد',projectId:'gym',priority:'low',source:'اطلاعات زیرساخت',date:'2025-11-10',state:'acknowledged'},
  ],
  charges: [],contracts: [],revenues: [],invoices: [],payments: [],exchangeRates: [],
  expenses: [
    {id:'e1',title:'VPS اصلی',projectId:'novaguard',category:'زیرساخت',amount:950000,date:'2025-11-21',status:'upcoming'},
    {id:'e2',title:'دامنه سرویس',projectId:'gym',category:'دامنه',amount:350000,date:'2025-12-06',status:'upcoming'},
    {id:'e3',title:'Backup Storage',projectId:'novaguard',category:'پشتیبان‌گیری',amount:180000,date:'2025-11-22',status:'paid'},
    {id:'e4',title:'سرویس استقرار',projectId:'mokmok',category:'اشتراک',amount:920000,date:'2025-11-11',status:'paid'},
    ...[780000,1120000,1340000,1480000,1240000].map((amount, i) => ({id:`prev-${i}`,title:'هزینهٔ ماهانه زیرساخت',projectId:i%2?'mokmok':'gym',category:'زیرساخت' as const,amount,date:`2025-${String(i+6).padStart(2,'0')}-11`,status:'paid' as const})),
  ],
  docs: [
    {id:'nova-runbook',title:'راهنمای راه‌اندازی مجدد NovaGuard',projectId:'novaguard',type:'Runbook',body:'این سند نمونه نحوه ثبت تغییرات و اقدامات بازیابی سرویس را توضیح می‌دهد.\n\nپیش‌نیازها\n• تأیید مسئول پروژه\n• شناسایی محیط Production\n• بررسی تاریخ آخرین نسخه پشتیبان\n\nنتیجهٔ تمرین بازیابی را در تاریخچهٔ پروژه ثبت کنید.',revision:3,updated:'2025-11-15'},
    {id:'gym-schema',title:'معماری دیتابیس باشگاه',projectId:'gym',type:'Technical Design',body:'مدل دادهٔ نمونه شامل مربی، جلسه و رزرو است. تطبیق بازه‌های زمانی و ظرفیت جلسه پیش از انتشار بازبینی می‌شود.',revision:2,updated:'2025-11-14'},
    {id:'mok-pricing',title:'قواعد موتور تطبیق بودجه',projectId:'mokmok',type:'Decision Record',body:'برای نسخهٔ آزمایشی، هزینهٔ هر برنامه از مجموع اقلام به دست می‌آید. قیمت‌های نمونه در گزارش تست این پروژه بررسی می‌شوند.',revision:4,updated:'2025-11-13'},
    {id:'gym-release',title:'چک‌لیست استقرار Production',projectId:'gym',type:'Checklist',body:'۱. جریان رزرو در موبایل و دسکتاپ بررسی شود.\n۲. تأیید آزمون رزرو تکراری ثبت شود.\n۳. نتیجهٔ تمرین بازیابی مستند شود.',revision:2,updated:'2025-11-12'},
    {id:'mok-release',title:'تغییرات نسخه‌های اخیر',projectId:'mokmok',type:'Release Notes',body:'در این نسخه، وضعیت قیمت‌ها در کارت محصول و جدول مقایسه خواناتر شده است.',revision:1,updated:'2025-11-09'},
  ],
  events: [
    {id:'ev1',title:'تغییر وضعیت وظیفه رزرو',detail:'وظیفهٔ TASK-024 به «در حال انجام» تغییر یافت.',projectId:'gym',actor:'همکار توسعه',source:'وظایف',date:'2025-11-16'},
    {id:'ev2',title:'یادداشت درباره موتور تطبیق قیمت',detail:'جمع‌بندی نتایج بررسی در مستندات ثبت شد.',projectId:'mokmok',actor:'همکار توسعه',source:'مستندات',date:'2025-11-15'},
    {id:'ev3',title:'منبع VPS به فهرست زیرساخت افزوده شد',detail:'رکورد نمونه با آدرس مستندسازی ثبت شد.',projectId:'novaguard',actor:'مدیر فضای کاری',source:'زیرساخت',date:'2025-11-14'},
    {id:'ev4',title:'چک‌لیست انتشار محصول به‌روزرسانی شد',detail:'معیارهای QA و آزمون رزرو تکمیل شدند.',projectId:'gym',actor:'همکار توسعه',source:'مستندات',date:'2025-11-12'},
    {id:'ev5',title:'برنامه تست پشتیبان ایجاد شد',detail:'وظیفهٔ بازبینی بازیابی دیتابیس اضافه شد.',projectId:'gym',actor:'مدیر فضای کاری',source:'وظایف',date:'2025-11-11'},
  ],
  integrations: [
    {id:'github',name:'GitHub',description:'کد، تغییرات و Issueها',art:'infrastructure/git-branch',protocol:'API / Webhook',connected:false},
    {id:'coolify',name:'Coolify',description:'استقرار، اپلیکیشن و سرورها',art:'infrastructure/deployment',protocol:'API',connected:false},
    {id:'infisical',name:'Infisical',description:'ارجاع به رکوردهای خزانه',art:'navigation/vault',protocol:'API',connected:false},
    {id:'uptime',name:'Uptime Kuma',description:'پایش سرویس‌ها و هشدارها',art:'navigation/monitoring',protocol:'Webhook',connected:false},
    {id:'email',name:'Email / SMTP',description:'اعلان و خلاصه‌های دوره‌ای',art:'navigation/notifications',protocol:'SMTP',connected:false},
    {id:'backup',name:'Backup Provider',description:'وضعیت پشتیبان‌ها و نقطهٔ بازیابی',art:'infrastructure/backup',protocol:'API',connected:false},
  ],
  users: [
    {id:'owner',name:'مدیر فضای کاری',email:'admin@example.com',role:'Owner',projectId:'',state:'active'},
    {id:'dev',name:'همکار توسعه',email:'dev@example.com',role:'Developer',projectId:'',state:'active'},
    {id:'viewer',name:'ناظر مشتری',email:'viewer@example.com',role:'Viewer',projectId:'gym',state:'invited'},
  ],
  preferences: { workspace:'فضای کاری شخصی', displayName:'مدیر فضای کاری', theme:'dark', language:'fa', zone:'Asia/Tehran', digest:true, renewal:true, outage:true, stale:false },
};

export const monitorFixtures = [
  {id:'gym-web',name:'Gym Production',address:'gym.example.com',state:'healthy'},
  {id:'mok-domain',name:'MOKMOK API',address:'api.mokmok.example',state:'healthy'},
  {id:'nova-domain',name:'NovaGuard Endpoint',address:'vpn.example.net',state:'unknown'},
  {id:'nova-backup',name:'Database Backup Job',address:'backup.nova.example',state:'unknown'},
] as const;
export const monitoringRanges = {
  '۲۴ ساعت': [99.86,99.90,99.88,99.92,99.96,99.94,99.98,99.99],
  '۷ روز': [99.76,99.82,99.89,99.86,99.93,99.91,99.97,99.99],
  '۳۰ روز': [99.64,99.69,99.73,99.82,99.80,99.85,99.86,99.93,99.89,99.92,99.92,99.97,99.96,99.99],
};
