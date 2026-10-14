// دليل مختصر لكل محرك يُرسل للموديل (نسخة مضغوطة من SKILL.md والمراجع — توفير توكن).
// المرجع الكامل بالمهارة نفسها؛ عند وضع «جودة» نضيف سجل الذوق الحي من public/engines/<id>/references.

export const GUZELESER_DOC = `
# محرك Güzel Eser (guzeleser-post) — منشورات جمعية إنسانية تركية
الناتج: بوست 4:5 + ستوري 9:16 من spec واحد. **النصوص تركي فقط**. الهوية: كحلي #0A355B + عنابي #8B1938.

## القاعدة الأولى: أقل عناصر، كل عنصر أقوى
- بطل واحد (العنوان) + **عنصر ثاني واحد قوي فقط** من: price · prices · features · stats · date — لا تجمع اثنين.
- icons: 0 افتراضياً، 2 حد أقصى. kicker اختياري (لا تحطه لو العنوان واضح).
- qr فقط مع price أو للحملات. لا تخترع أسعار/أرقام/تواريخ — استخدم الموجود بالخطة فقط.

## الوصفات
| الغرض | theme | العنصر الثاني | ملاحظات |
|---|---|---|---|
| كفالة / بدل (Bedel) | light أو clean | price | text_align:"left", footer:"logo" |
| أضحية / حملة عاجلة | navy | price (+qr) | tagline |
| مشروع بسعرين | light, shape:"panel" | prices | |
| رمضان / قائمة أسعار | light | prices + prices_style:"icons" | |
| طوارئ / احتياجات | light | features | photo.treat:"mono" |
| توثيق مشروع منفّذ | light | stats | photo.mode:"full" |
| يوم عالمي | light, shape:"arch" | date | |
| الجمعة / مناسبة دينية | navy، بدون صورة | — | title فيه _كلمة_، rule:true، decor:{pattern:true} |
| توعية عامة | light, shape:"arch"/"circle" | — أو features | |

## الحقول
- theme: light · clean · navy. shape: arch · emblem · circle · panel · none (مع الصورة المشهد الافتراضي يكفي).
- title: مصفوفة 2-3 أسطر، 2-3 كلمات للسطر. ترميز: *كلمة* عنابي · {كلمة} سماوي · [كلمة] شريط مائل · _كلمة_ خط يد (سطر لحاله = أكبر) · ~كلمة~ خفيف · ^كلمة^ صغير. كلمة وحدة مبروزة.
- tagline: وسم مائل ≤5 كلمات. subtitle: سطرين (~30-38 حرف)، *كلمة* عريضة. sub_style: strips|boxed اختياري.
- kicker / kicker_icon: سطر صغير فوق العنوان (نادراً).
- text_align: center|left. footer: bar|logo.
- price: {"label":"Kurban\\nHisse Bedeli","value":"6.500₺","note":"Yemen","icon":"heart"}
- prices: [{"label":"Asya","value":"17.000₺","icon":"droplet"}] — prices_style: bar|icons
- features: [{"icon":"bread","label":"Gıda"}] (3-4)
- stats: [{"n":"3.400","l":"Aileye ulaştı","icon":"users"}] (2-3)
- date: {"day":"5","month":"Eylül","label":"Uluslararası\\nHayırseverlik\\nGünü"}
- cta: {"text":"Bağış Yap","url":"guzeleser.org/bagis"} · qr: true
- icons: ["building-mosque"] (≤2) · decor: {"pattern":true,"glass":true,"rays":true}
- photo: {"ref":"P1","mode":"cutout"|"full","treat":"mono"?} — ref من قائمة الصور المتاحة فقط. cutout للأشخاص الواضحين، full للمشاهد/الحشود/الصور اللي القص ما ينفعها.
- story: تجاوزات للستوري مثل {"story":{"title":[...]}} لو العنوان طويل.
أيقونات (Tabler): heart heart-handshake droplet bread wheat tent home school book shirt package bowl coin first-aid-kit building-mosque moon-stars star sparkles gift users truck map-pin baby-carriage basket.

## النص التركي
- أسعار: "Bağış Bedeli", "Hisse Bedeli", "Sponsorluk Bedeli", "Kuyu Bedeli" — الأرقام بنقطة + ₺ ("2.500₺").
- إملاء: Bağış Yap, Yemen'e, Hayırlı Cumalar, Kandiliniz Mübarek Olsun, Hayırlı Ramazanlar. الحساب guzeleserorg.
- لغة كرامة وأمل، بدون سياسة ولا صور صادمة. لو المحتوى بالخطة عربي → ترجمه لتركي سليم وطبيعي (مو حرفي).

## المثال
{"theme":"clean","shape":"emblem","text_align":"left","footer":"logo","photo":{"ref":"P1","mode":"cutout"},
 "title":["Bir Çocuğun","Bayram *Sevincine*","Ortak Olun"],"subtitle":["Yemen'deki yetimlere","*bayramlık kıyafet* hediye edin."],
 "price":{"label":"Bayramlık\\nBedeli","value":"2.500₺","icon":"shirt"}}
`.trim();

export const INVESTORS_DOC = `
# محرك بوابة المستثمر (investors-gate) — خدمات أعمال سعودية، عربي RTL
العميل **يكره شكل الذكاء الاصطناعي**: رايق، فخم، واقعي، متّسق — شغل وكالة.

## القواعد الذهبية
1. **المحتوى حرفي من الخطة** — لا شرائح ولا عناوين ولا جمل من عندك. المسموح: تقسيم الأسطر، إزالة الإيموجي، تصحيح إملائي واضح.
2. لا أرقام مخترعة (الإحصاءات المسموحة فقط من brand.stats). الخدمات الحكومية: «نساعدك/نتابع» مو «نضمن».
3. اللون حسب الخدمة (theme):
   svc_investor (أجنبي، كيان خارجي، شركة دولية، غير سعودي) · svc_formation (تأسيس، فرع، سجل تجاري، تراخيص) ·
   svc_residency (الإقامة المميزة) · svc_trademark (العلامة التجارية) · svc_accounting (قوائم مالية، محاسبة، زكاة) ·
   graphite (العلامة الأم: أخبار، إنجازات، مناسبات). شريحة تأكيد داكنة وحدة بالكاروسيل مسموحة (theme:"graphite").
4. عربي سليم: همزات الوصل، «على/إلى»، الترقيم.

## preset (اكتب المحتوى والفروقات فقط — الإعدادات المعتمدة تندمج تلقائياً)
- concept_single: منشور مفرد — شخص/أصل بطل + عنوان + صندوق زجاجي (+ مثلث تنبيه warn_glass لو فيه تحذير).
- carousel_clean ★: كاروسيل بأصول مقصوصة (photo cutout، أرضية ضوئية) — كل أصل بشريحة وحدة ولا يتكرر.
- carousel_scenes: كاروسيل بمشاهد كاملة (صورة خلفية كاملة + النص بالفراغ فوقها).
- news_story: خبر/تعميم رسمي كسلسلة ستوري (نص حرفي، ≈4 ستوريات، الخط ≥ 28px).
- reel_cover: غلاف ريل 9:16 — الشعار بالوسط + عنوان كبير بمارك + الأصل أكبر شي.

## بنية spec
{"preset":"carousel_clean","theme":"svc_formation","caption":"…حرفي من الخطة…","hashtags":["#بوابة_المستثمر",…],
 "slides":[ {شريحة}, … ]}
أنواع الشرائح (type): concept ★ (الأساسي) · cover · statement · point · list · chips · compare · stats · steps · faq · cta · occasion · poster.
### concept
{"type":"concept","title":["سطر","سطر *مميز*"],"title_fs":66,"sub":"سطر صغير","box":"سطر بصندوق زجاجي","box_style":"glass",
 "sections":[…],"photo":{"src":"P1","area":"cutout","flip":false},"warn_glass":{"lines":["تنبيه","للمستثمر الأجنبي"]},"phone_line":true}
- title_fs: 60-80 (المنشور المفرد ~66). grow:false بالمفرد.
- photo.src = معرّف صورة من القائمة (P1، P2…) — أو احذف photo لو ما فيه صورة مناسبة. area: cutout (أصل/شخص مقصوص) · full (مشهد كامل) · bottom/top.
- الشريحة الأخيرة بالكاروسيل: phone_line:true (رقم التواصل من الهوية تلقائياً).
### أقسام (sections[].s)
- body: {"s":"body","t":["سطر","سطر"],"fs":30}
- duo (مقارنة بأيقونات): {"s":"duo","style":"open","items":[{"icon":"building","h":"عنوان","t":"نص","tone":"a"},{"icon":"git-branch","h":"…","t":"…","tone":"b"}]}
- chipsx: {"s":"chipsx","items":["مستثمر فرد","شركة أجنبية"]}
- hl (تأكيد): {"s":"hl","t":"الجملة المهمة","note":"ملاحظة"}
- reqs (أرقام مفرّغة كبيرة ≤4): {"s":"reqs","style":"big","items":["…","…"]}
- list: {"s":"list","style":"plain|check|numbered","items":[…]}
- table: {"s":"table","cols":[{"h":"شركة مستقلة","tone":"a"},{"h":"فرع","tone":"b"}],"rows":[{"h":"مستثمر فرد","cells":[true,false]}]}
- أقسام الأخبار: ctx · ncard · regions · meta.
### ترميز النص
*كلمة* ذهبي مميز · [كلمة] مارك/شريط · ~كلمة~ خط يدوي تحتها · {كلمة} خفيف · =كلمة= مدّ قوي. kashida:"auto" بعنوان أو اثنين فقط (الغلاف/الخاتمة).

## مرفوض (لا تستخدمه أبداً)
footbar · إطار الزوايا · دوائر/حلقات خلف الشخص · زجاج خلف الأصل · خط ذهبي سفلي (span path) · كيكر/كلمات فوق العنوان («01 · …»، «الخلاصة») ·
«اسحب لمعرفة الفرق» · سطر «استثمارك في أمان» داخل التصميم · تكرار نفس الصورة بشريحتين · نص أصفر على ذهبي · خرائط كخلفية.
`.trim();

export const OUTPUT_CONTRACT = `
أرجع **JSON فقط** (بدون شرح): {"spec": {...}, "notes": "سطر للمصمم: الفكرة/القرار أو أي نقص (صورة ناقصة، سعر غير مؤكد)"}.
لا تكتب حقول المسارات (src لملفات، dir، out_dir) — للصور استخدم المعرّفات المعطاة فقط (P1، P2…).
`.trim();
