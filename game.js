'use strict';
// ============================================================
// RYZHIK: MYSTERY OF THE COUNTRY HOUSE
// Full game implementation
// ============================================================

// ============================================================
// TELEGRAM BRIDGE
// ============================================================
class TelegramBridge {
  constructor() {
    this.tg = window.Telegram?.WebApp || null;
    this.available = !!this.tg;
    if (this.available) {
      this.tg.ready();
      this.tg.expand();
      this.tg.disableVerticalSwipes?.();
      document.documentElement.style.setProperty('--tg-bg', this.tg.themeParams?.bg_color || '#0a1a05');
      document.documentElement.style.setProperty('--tg-text', this.tg.themeParams?.text_color || '#ffefd5');
    }
  }
  vibrate(pattern = [20]) {
    if (this.available) this.tg.HapticFeedback?.impactOccurred('light');
    else if (navigator.vibrate) navigator.vibrate(pattern);
  }
  showMainButton(text, cb) {
    if (!this.available) return;
    this.tg.MainButton.setText(text);
    this.tg.MainButton.show();
    this.tg.MainButton.onClick(cb);
  }
  hideMainButton() {
    if (this.available) this.tg.MainButton.hide();
  }
  showBackButton(cb) {
    if (!this.available) return;
    this.tg.BackButton.show();
    this.tg.BackButton.onClick(cb);
  }
  hideBackButton() {
    if (this.available) this.tg.BackButton.hide();
  }
}

// ============================================================
// AUDIO SYSTEM
// ============================================================
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.7;
    this.sfxVol = 0.8;
    this.musicNode = null;
    this.enabled = true;
    this._init();
  }
  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { this.enabled = false; }
  }
  _resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }
  playTone(freq, type, duration, vol = 0.3, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      gain.gain.setValueAtTime(vol * this.sfxVol, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch(e) {}
  }
  meow() {
    this.playTone(600, 'sine', 0.08, 0.25);
    this.playTone(750, 'sine', 0.15, 0.25, 0.08);
    this.playTone(550, 'sine', 0.12, 0.2, 0.2);
  }
  purr() {
    for (let i = 0; i < 4; i++) {
      this.playTone(80 + i * 5, 'sawtooth', 0.3, 0.05, i * 0.08);
    }
  }
  pickup() {
    this.playTone(440, 'sine', 0.06, 0.2);
    this.playTone(660, 'sine', 0.08, 0.2, 0.06);
    this.playTone(880, 'sine', 0.1, 0.15, 0.14);
  }
  questComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.playTone(n, 'sine', 0.15, 0.3, i * 0.12));
  }
  uiClick() {
    this.playTone(330, 'sine', 0.06, 0.15);
  }
  step() {
    const f = 80 + Math.random() * 20;
    this.playTone(f, 'triangle', 0.04, 0.08);
  }
  startAmbience() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._ambientLoop();
  }
  _ambientLoop() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const notes = [261, 293, 329, 392, 440];
    const n = notes[Math.floor(Math.random() * notes.length)];
    this.playTone(n, 'sine', 2.5, 0.04 * this.musicVol);
    setTimeout(() => this._ambientLoop(), 2000 + Math.random() * 3000);
  }
}

// ============================================================
// SAVE SYSTEM
// ============================================================
class SaveSystem {
  static KEY = 'ryzhik_save_v3';
  static save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); return true; }
    catch(e) { return false; }
  }
  static load() {
    try {
      const s = localStorage.getItem(this.KEY);
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  }
  static reset() { localStorage.removeItem(this.KEY); }
  static exists() { return !!localStorage.getItem(this.KEY); }
}

// ============================================================
// GAME DATA: ITEMS
// ============================================================
const ITEMS = {
  bowl: { id:'bowl', name:'Миска', icon:'🥣', desc:'Старая миска Рыжика. Нужно вернуть на место.', rarity:'common', use:'quest' },
  fish: { id:'fish', name:'Рыбка', icon:'🐟', desc:'Свежая рыбка. Рыжик любит рыбу.', rarity:'common', use:'food', hunger:40 },
  apple: { id:'apple', name:'Яблоко', icon:'🍎', desc:'Румяное яблоко из сада.', rarity:'common', use:'food', hunger:20 },
  feather: { id:'feather', name:'Перо', icon:'🪶', desc:'Красивое перо, найденное во дворе.', rarity:'common', use:'quest' },
  yarn: { id:'yarn', name:'Клубок', icon:'🧶', desc:'Клубок шерсти — отличная игрушка.', rarity:'common' },
  barn_key: { id:'barn_key', name:'Ключ от сарая', icon:'🗝️', desc:'Старый ключ. Подходит к замку сарая.', rarity:'uncommon' },
  coin: { id:'coin', name:'Старая монета', icon:'🪙', desc:'Потёртая монета непонятного происхождения.', rarity:'uncommon' },
  pebble: { id:'pebble', name:'Блестящий камешек', icon:'💎', desc:'Переливается на солнце.', rarity:'common' },
  letter: { id:'letter', name:'Письмо', icon:'📜', desc:'Пожелтевшее письмо с неразборчивыми строками.', rarity:'rare' },
  seeds: { id:'seeds', name:'Семена', icon:'🌱', desc:'Семена неизвестного растения.', rarity:'common' },
  ribbon: { id:'ribbon', name:'Ленточка', icon:'🎀', desc:'Яркая ленточка от Насти.', rarity:'common' },
  bell: { id:'bell', name:'Колокольчик', icon:'🔔', desc:'Звенит мелодично. Где-то видел похожий...', rarity:'rare' },
  mouse_map: { id:'mouse_map', name:'Карта мышонка', icon:'🗺️', desc:'Мышиная карта с пометками кладов.', rarity:'rare' },
  glasses: { id:'glasses', name:'Очки бабушки', icon:'👓', desc:'Бабушкины очки. Нужно вернуть.', rarity:'uncommon' },
  toy_mouse: { id:'toy_mouse', name:'Игрушечная мышь', icon:'🐭', desc:'Мягкая игрушка. Рыжик в восторге.', rarity:'common' },
  rare_leaf: { id:'rare_leaf', name:'Редкий лист', icon:'🍃', desc:'Лист необычной формы.', rarity:'uncommon' },
  button: { id:'button', name:'Пуговица', icon:'🔵', desc:'Синяя пуговица. Может быть от чьей-то одежды.', rarity:'common' },
  dry_food: { id:'dry_food', name:'Сухой корм', icon:'🍪', desc:'Кошачий корм. Восстанавливает сытость.', rarity:'common', use:'food', hunger:30 },
  star_acorn: { id:'star_acorn', name:'Звёздный жёлудь', icon:'⭐', desc:'Жёлудь, упавший в звёздную ночь. Очень редкий.', rarity:'legendary' },
  sun_bell: { id:'sun_bell', name:'Солнечный колокольчик', icon:'🌟', desc:'Символ тепла, дружбы и дома. Главная тайна теплицы.', rarity:'legendary' },
  cassette: { id:'cassette', name:'Кассета Лёхи', icon:'📼', desc:'Старая аудиокассета. Лёха её ищет.', rarity:'uncommon' },
  pick: { id:'pick', name:'Медиатор', icon:'🎸', desc:'Медиатор Игоря. Потерял у пруда.', rarity:'common' },
  stickers: { id:'stickers', name:'Наклейки', icon:'✨', desc:'Яркие наклейки Лизы.', rarity:'common' },
  diary_page: { id:'diary_page', name:'Страница дневника', icon:'📄', desc:'Страница из дневника Нэны.', rarity:'uncommon' },
  flashlight_part: { id:'flashlight_part', name:'Деталь фонарика', icon:'🔦', desc:'Деталь для ремонта фонарика.', rarity:'common' },
  moon_bell: { id:'moon_bell', name:'Колокольчик луны', icon:'🌙', desc:'Загадочный колокольчик Мага.', rarity:'rare' },
};

// ============================================================
// GAME DATA: NPC
// ============================================================
const NPC_DATA = {
  lyokha: {
    id: 'lyokha', name: 'Лёха', color: '#74b9ff',
    hairColor: '#e8d5a0', skinColor: '#fcd1a0', clothColor: '#dfe6e9',
    x: 800, y: 600, zone: 'porch',
    personality: 'добрый и спокойный',
    schedule: { morning:'porch', day:'garden', evening:'porch', night:'inside' },
    quest: 'cassette_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Привет, Рыжик! Давно не видел тебя. Ты такой рыжий, прямо как закат.', 'Хочешь поесть? Сейчас принесу что-нибудь.'],
      morning: ['Доброе утро, Рыжик. Хорошо спалось?', 'Утренний воздух такой свежий здесь.'],
      day: ['Я тут в саду. Видишь, яблоки поспели?', 'Хорошо, что ты зашёл. Скучно одному.'],
      evening: ['Вечером лучше всего сидеть на крыльце. Правда, Рыжик?', 'Слышишь? Кузнечики поют.'],
      night: ['Ночью здесь так красиво. Звёзды близко.', 'Иногда ночью слышу странные звуки из теплицы...'],
      friendly: ['Рыжик, ты мой лучший друг! Хочешь сыграю тебе на гитаре?'],
    }
  },
  igor: {
    id: 'igor', name: 'Игорь', color: '#fd79a8',
    hairColor: '#2d3436', skinColor: '#fcd1a0', clothColor: '#2d3436',
    x: 1200, y: 800, zone: 'yard',
    personality: 'шумный, эмоциональный, добрый',
    schedule: { morning:'barn', day:'pond', evening:'yard', night:'yard' },
    quest: 'pick_quest',
    trustLevel: 0,
    dialogs: {
      first: ['О, Рыжик! Чуваки, смотрите — кот!', 'Слушай, ты такой крутой! Тебе бы косуху.'],
      morning: ['Рано встал, Рыжик? Я вообще не спал — репетировал.'],
      day: ['Потерял медиатор где-то у пруда. Без него никак.'],
      evening: ['Вечером буду играть рок-баллады. Приходи послушать!'],
      night: ['Ночные концерты — лучшее!'],
      friendly: ['Рыжик, ты уже умеешь рок-мяу? Дай покажу!'],
    }
  },
  nastya: {
    id: 'nastya', name: 'Настя', color: '#55efc4',
    hairColor: '#6d4c41', skinColor: '#fcd1a0', clothColor: '#e84393',
    x: 1600, y: 400, zone: 'garden',
    personality: 'заботливая, загадочная',
    schedule: { morning:'garden', day:'pond', evening:'yard', night:'garden' },
    quest: 'firefly_photo',
    trustLevel: 0,
    dialogs: {
      first: ['Ой, какой красивый котик! Можно тебя сфотографировать?', 'Ты тут живёшь? Я буду приходить чаще.'],
      morning: ['Утром цветы такие свежие. Смотри, какая роса.'],
      day: ['Хочу сделать фото со светлячками ночью. Поможешь мне найти нужное место?'],
      evening: ['Вечером всё становится золотым. Люблю этот свет.'],
      night: ['Тихо... Слышишь, как поёт ночь?'],
      friendly: ['Рыжик, держи — это ленточка для тебя! Ты у меня на всех фотках.'],
    }
  },
  liza: {
    id: 'liza', name: 'Лиза', color: '#fd79a8',
    hairColor: '#e84393', skinColor: '#fcd1a0', clothColor: '#fdcb6e',
    x: 400, y: 1000, zone: 'yard',
    personality: 'весёлая, активная, хаотичная',
    schedule: { morning:'inside', day:'yard', evening:'yard', night:'inside' },
    quest: 'sticker_quest',
    trustLevel: 0,
    dialogs: {
      first: ['РЫЖИК!!! Ты такой милый! Иди сюда!', 'Я принесла коробки для тебя! Ты любишь коробки?'],
      morning: ['Я только проснулась... нет, погоди, я в порядке!'],
      day: ['Потеряла наклейки везде по двору. Они такие красивые были...'],
      evening: ['Вечеринку во дворе устроим! Ты придёшь, Рыжик?'],
      night: ['Ладно-ладно, пора спать. Рыжик, давай обниму.'],
      friendly: ['Рыжик — лучший кот на свете! Я украшу твой уголок!'],
    }
  },
  mag: {
    id: 'mag', name: 'Маг', color: '#a29bfe',
    hairColor: '#2d3436', skinColor: '#b2bec3', clothColor: '#2d3436',
    x: 2000, y: 1200, zone: 'greenhouse',
    personality: 'странный, загадочный, не злой',
    schedule: { morning:'none', day:'none', evening:'greenhouse', night:'greenhouse' },
    quest: 'moon_bell_quest',
    trustLevel: 0,
    dialogs: {
      first: ['...Ты пришёл. Я ждал тебя, рыжий страж.', 'В этом доме есть тайна. Ты её почувствовал?'],
      evening: ['Вечер — время, когда тайны выходят на поверхность.', 'Следи за луной, кот.'],
      night: ['Ночь знает всё. Спрашивай.', 'Теплица... там что-то спит уже давно.'],
      friendly: ['Ты прошёл испытание, рыжий. Теперь я расскажу тебе о Солнечном колокольчике...'],
    }
  },
  sonya: {
    id: 'sonya', name: 'Соня', color: '#74b9ff',
    hairColor: '#f0e68c', skinColor: '#fcd1a0', clothColor: '#27ae60',
    x: 2400, y: 600, zone: 'forest_path',
    personality: 'спокойная, выносливая',
    schedule: { morning:'forest_path', day:'forest_path', evening:'yard', night:'inside' },
    quest: 'forest_trail',
    trustLevel: 0,
    dialogs: {
      first: ['О, привет! Ты местный кот? Я Соня. Люблю походы.', 'Здесь красиво. Лес близко.'],
      morning: ['Хорошее утро для прогулки. Пойдём?'],
      day: ['Я нашла новую тропу! Но туда без тебя не хочу.'],
      evening: ['Устала. Зато какие виды! Рыжик, ты отличный напарник.'],
      friendly: ['Рыжик, открою тебе лесные тропинки! Ты теперь знаешь этот лес лучше всех.'],
    }
  },
  nena: {
    id: 'nena', name: 'Нэна', color: '#dfe6e9',
    hairColor: '#2d3436', skinColor: '#e0c8a0', clothColor: '#636e72',
    x: 900, y: 1300, zone: 'yard',
    personality: 'умная, тихая, наблюдательная',
    schedule: { morning:'yard', day:'yard', evening:'porch', night:'inside' },
    quest: 'diary_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Хм. Кот. Интересно.', 'Я записываю странные вещи, происходящие здесь. Ты тоже замечал?'],
      morning: ['Вчера видела что-то необычное. Записала в дневник.'],
      day: ['Потеряла страницы дневника. Ветром унесло.'],
      evening: ['По вечерам здесь происходит кое-что странное. Я за этим слежу.'],
      friendly: ['Рыжик, ты знаешь о теплице больше, чем говоришь. Я это чувствую.'],
    }
  },
  kristina: {
    id: 'kristina', name: 'Кристина', color: '#e17055',
    hairColor: '#795548', skinColor: '#fcd1a0', clothColor: '#2c3e50',
    x: 200, y: 700, zone: 'fence',
    personality: 'уверенная, добрая, сначала холодная',
    schedule: { morning:'fence', day:'fence', evening:'yard', night:'inside' },
    quest: 'flashlight_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Кот. Не мешай, я тут работаю.', '...Ладно, ты ничего. Рыжий.'],
      morning: ['Забор починю к вечеру. Если не буду отвлекаться.'],
      day: ['Фонарик сломался. Нужны детали.'],
      evening: ['Устала, но доделала. Приятно, когда что-то работает.'],
      friendly: ['Слушай, ты нормальный кот. Помогу тебе с уголком.'],
    }
  },
  danya: {
    id: 'danya', name: 'Даня', color: '#fdcb6e',
    hairColor: '#e84393', skinColor: '#fcd1a0', clothColor: '#3d5a80',
    x: 1400, y: 1100, zone: 'barn',
    personality: 'смешной, странный',
    schedule: { morning:'barn', day:'yard', evening:'barn', night:'barn' },
    quest: 'treasure_box',
    trustLevel: 0,
    dialogs: {
      first: ['А! Кот! Отлично, ты мне поможешь!', 'Я делаю штуку... ну, из мусора. Но это не мусор, это искусство.'],
      morning: ['Уже делаю что-то. Ещё не знаю что, но делаю.'],
      day: ['Рассыпал детали по всему двору. Беда.'],
      evening: ['Почти собрал! Или разобрал. Непонятно.'],
      friendly: ['Рыжик! Сделаю тебе игрушку — пальчики оближешь, то есть лапки.'],
    }
  },
  prokhor: {
    id: 'prokhor', name: 'Прохор', color: '#b2bec3',
    hairColor: '#2d3436', skinColor: '#c68642', clothColor: '#2c3e50',
    x: 300, y: 300, zone: 'fence',
    personality: 'снаружи грозный, внутри добрый',
    schedule: { morning:'fence', day:'fence', evening:'yard', night:'inside' },
    quest: 'old_fence_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Кот. Хм.', '...Рыжий значит. Ладно.'],
      morning: ['Не мешай. Работаю.'],
      day: ['Забор сам себя не починит. Хотя с тобой веселее.'],
      evening: ['Ну ты ничего такой, кот. Серьёзный.'],
      friendly: ['Рыжик... ты хороший. Я скажу тебе кое-что важное про подвал.'],
    }
  },
  babushka: {
    id: 'babushka', name: 'Бабушка', color: '#fdcb6e',
    hairColor: '#b2bec3', skinColor: '#fcd1a0', clothColor: '#74b9ff',
    x: 700, y: 400, zone: 'porch',
    personality: 'добрая, заботливая',
    schedule: { morning:'porch', day:'garden', evening:'porch', night:'inside' },
    quest: 'glasses_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Рыжик, кисонька! Иди сюда, я тебе молочка налью.', 'Такой хороший котик. Прямо как в детстве у нас был.'],
      morning: ['Доброе утро, Рыжик. Завтрак готов.'],
      day: ['Потеряла очки опять... куда они делись?'],
      evening: ['Вечером пирог испекла. Хочешь попробовать?'],
      friendly: ['Рыжик, ты мой любимый! Вот тебе новая миска, золотая моя.'],
    }
  },
  baron: {
    id: 'baron', name: 'Барон', color: '#636e72',
    hairColor: null, skinColor: '#7f8c8d', clothColor: null,
    isAnimal: true, animalType: 'dog',
    x: 500, y: 800, zone: 'yard',
    personality: 'ворчливый пёс, добрый в глубине души',
    schedule: { morning:'yard', day:'yard', evening:'fence', night:'kennel' },
    quest: 'baron_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Гав! Мой двор! Уйди!', '...Что смотришь? Уйди говорю.'],
      day: ['Гав-гав. Ладно, стой. Я просто проверяю.'],
      friendly: ['Ладно, рыжий. Ты ничего. Можешь жить тут.'],
    }
  },
  musa: {
    id: 'musa', name: 'Муся', color: '#a29bfe',
    hairColor: null, skinColor: '#b2bec3', clothColor: null,
    isAnimal: true, animalType: 'cat',
    x: 1000, y: 600, zone: 'garden',
    personality: 'нежная кошка',
    schedule: { morning:'garden', day:'garden', evening:'porch', night:'inside' },
    quest: 'kitten_quest',
    trustLevel: 0,
    dialogs: {
      first: ['Мяу... (Привет, незнакомец)'],
      friendly: ['Мур... (Ты хороший)'],
    }
  },
};

// ============================================================
// GAME DATA: QUESTS
// ============================================================
const QUESTS = {
  find_bowl: {
    id: 'find_bowl', title: '🥣 Найти миску Рыжика',
    desc: 'Кто-то переставил твою миску. Поищи по двору.',
    steps: [{desc:'Найди миску во дворе', target:'bowl', count:1}],
    reward: {items:['fish'], exp:10, trustNPC:'babushka'},
    zone: 'yard', trigger: 'start'
  },
  glasses_quest: {
    id: 'glasses_quest', title: '👓 Очки бабушки',
    desc: 'Бабушка потеряла очки. Помоги найти их в саду.',
    steps: [{desc:'Найди очки в саду', target:'glasses', count:1}],
    reward: {items:['dry_food','dry_food'], exp:15, trustNPC:'babushka'},
    zone: 'garden', trigger: 'talk:babushka'
  },
  baron_quest: {
    id: 'baron_quest', title: '🐕 Подружиться с Бароном',
    desc: 'Барон никому не доверяет. Принеси ему угощение.',
    steps: [{desc:'Принеси Барону угощение', target:'give:baron:fish', count:1}],
    reward: {items:['pebble'], exp:20, trustNPC:'baron'},
    zone: 'yard', trigger: 'start'
  },
  barn_key_quest: {
    id: 'barn_key_quest', title: '🗝️ Ключ от сарая',
    desc: 'Где-то в огороде лежит ключ от сарая.',
    steps: [{desc:'Найди ключ в огороде', target:'barn_key', count:1}],
    reward: {zone:'barn', exp:25},
    zone: 'vegetable_garden', trigger: 'talk:prokhor'
  },
  cassette_quest: {
    id: 'cassette_quest', title: '📼 Старая кассета',
    desc: 'Лёха потерял любимую кассету в сарае.',
    steps: [{desc:'Найди кассету в сарае', target:'cassette', count:1}, {desc:'Отдай кассету Лёхе', target:'give:lyokha:cassette', count:1}],
    reward: {items:['coin'], exp:20, trustNPC:'lyokha'},
    zone: 'barn', trigger: 'talk:lyokha'
  },
  pick_quest: {
    id: 'pick_quest', title: '🎸 Пропавший медиатор',
    desc: 'Игорь потерял медиатор около пруда.',
    steps: [{desc:'Найди медиатор у пруда', target:'pick', count:1}, {desc:'Отдай медиатор Игорю', target:'give:igor:pick', count:1}],
    reward: {items:['rare_leaf'], exp:20, trustNPC:'igor'},
    zone: 'pond', trigger: 'talk:igor'
  },
  sticker_quest: {
    id: 'sticker_quest', title: '✨ Потерянные наклейки',
    desc: 'Лиза разбросала наклейки по всему двору.',
    steps: [{desc:'Собери 5 наклеек', target:'stickers', count:5}],
    reward: {items:['ribbon'], exp:15, trustNPC:'liza'},
    zone: 'yard', trigger: 'talk:liza'
  },
  apple_quest: {
    id: 'apple_quest', title: '🍎 Собрать яблоки',
    desc: 'В саду поспели яблоки. Собери немного для ёжика.',
    steps: [{desc:'Собери 3 яблока в саду', target:'apple', count:3}],
    reward: {items:['feather'], exp:15},
    zone: 'garden', trigger: 'start'
  },
  firefly_photo: {
    id: 'firefly_photo', title: '🌟 Фото со светлячками',
    desc: 'Настя хочет сделать ночную фотографию со светлячками.',
    steps: [{desc:'Найди место со светлячками ночью', target:'firefly_spot', count:1}],
    reward: {items:['ribbon','feather'], exp:25, trustNPC:'nastya'},
    zone: 'pond', trigger: 'talk:nastya', timeReq: 'night'
  },
  moon_bell_quest: {
    id: 'moon_bell_quest', title: '🌙 Колокольчик луны',
    desc: 'Маг просит найти старый колокольчик.',
    steps: [{desc:'Найди колокольчик луны ночью', target:'moon_bell', count:1}, {desc:'Отдай колокольчик Магу', target:'give:mag:moon_bell', count:1}],
    reward: {items:['star_acorn'], exp:40, trustNPC:'mag'},
    zone: 'meadow', trigger: 'talk:mag', timeReq: 'night'
  },
  forest_trail: {
    id: 'forest_trail', title: '🌲 Лесная тропа',
    desc: 'Соня знает тропу в лес, но без тебя идти не хочет.',
    steps: [{desc:'Исследуй лесную тропу с Соней', target:'explore:forest_path', count:1}],
    reward: {zone:'forest_path', exp:30, trustNPC:'sonya'},
    zone: 'forest_path', trigger: 'talk:sonya'
  },
  diary_quest: {
    id: 'diary_quest', title: '📄 Странные записи',
    desc: 'Нэна потеряла страницы дневника.',
    steps: [{desc:'Найди 3 страницы дневника', target:'diary_page', count:3}],
    reward: {items:['coin','pebble'], exp:20, trustNPC:'nena'},
    zone: 'yard', trigger: 'talk:nena'
  },
  flashlight_quest: {
    id: 'flashlight_quest', title: '🔦 Сломанный фонарик',
    desc: 'Кристина ищет детали для ремонта фонарика.',
    steps: [{desc:'Найди 2 детали фонарика', target:'flashlight_part', count:2}],
    reward: {items:['coin'], exp:20, trustNPC:'kristina', unlocks:'cat_corner_upgrade'},
    zone: 'barn', trigger: 'talk:kristina'
  },
  treasure_box: {
    id: 'treasure_box', title: '📦 Коробка сокровищ',
    desc: 'Даня рассыпал детали по двору.',
    steps: [{desc:'Собери детали для Дании', target:'button', count:3}],
    reward: {items:['toy_mouse'], exp:20, trustNPC:'danya'},
    zone: 'yard', trigger: 'talk:danya'
  },
  old_fence_quest: {
    id: 'old_fence_quest', title: '🔨 Старый забор',
    desc: 'Прохор чинит забор. Помоги ему найти нужные инструменты.',
    steps: [{desc:'Найди деревяшку у сарая', target:'rare_leaf', count:1}],
    reward: {items:['pebble','coin'], exp:25, trustNPC:'prokhor'},
    zone: 'barn', trigger: 'talk:prokhor'
  },
  kitten_quest: {
    id: 'kitten_quest', title: '🐱 Котёнок Муси',
    desc: 'Муся потеряла своего котёнка. Поищи в теплице.',
    steps: [{desc:'Найди котёнка в теплице', target:'explore:greenhouse', count:1}],
    reward: {items:['toy_mouse'], exp:30, trustNPC:'musa'},
    zone: 'greenhouse', trigger: 'talk:musa'
  },
  fishing: {
    id: 'fishing', title: '🎣 Поймать рыбку у пруда',
    desc: 'У пруда можно порыбачить!',
    steps: [{desc:'Поймай рыбку у пруда', target:'minigame:fishing', count:1}],
    reward: {items:['fish','fish'], exp:15},
    zone: 'pond', trigger: 'start'
  },
  postman: {
    id: 'postman', title: '📬 Разбудить почтальона',
    desc: 'Почтальон задремал у ворот. Разбуди его мяуканьем.',
    steps: [{desc:'Мяукни 3 раза у ворот', target:'meow:gate', count:3}],
    reward: {items:['letter'], exp:10},
    zone: 'fence', trigger: 'start'
  },
  cat_corner: {
    id: 'cat_corner', title: '🛏️ Починить кошачий уголок',
    desc: 'Кошачий уголок совсем обветшал. Нужно привести его в порядок.',
    steps: [{desc:'Найди подушку', target:'yarn', count:1}],
    reward: {items:['ribbon'], exp:20, unlocks:'cat_corner_level2'},
    zone: 'yard', trigger: 'start'
  },
  shiny_collection: {
    id: 'shiny_collection', title: '💎 Коллекция блестяшек',
    desc: 'Собери 5 блестящих камешков по всей карте.',
    steps: [{desc:'Найди камешки', target:'pebble', count:5}],
    reward: {items:['star_acorn'], exp:30},
    zone: 'all', trigger: 'start'
  },
  old_letters: {
    id: 'old_letters', title: '📜 Записки старого хозяина',
    desc: 'В доме спрятаны старые письма. Найди их.',
    steps: [{desc:'Найди 2 письма', target:'letter', count:2}],
    reward: {items:['moon_bell'], exp:35, trustNPC:'mag'},
    zone: 'attic', trigger: 'explore:attic'
  },
  open_greenhouse: {
    id: 'open_greenhouse', title: '🌿 Открыть теплицу',
    desc: 'Старая теплица заперта. Нужен ключ.',
    steps: [{desc:'Найди ключ от теплицы', target:'barn_key', count:1}, {desc:'Открой теплицу', target:'unlock:greenhouse', count:1}],
    reward: {zone:'greenhouse', exp:40},
    zone: 'greenhouse', trigger: 'talk:mag'
  },
  sun_bell_quest: {
    id: 'sun_bell_quest', title: '🌟 Найти Солнечный колокольчик',
    desc: 'В теплице спрятан главный секрет — Солнечный колокольчик.',
    steps: [{desc:'Найди Солнечный колокольчик в теплице', target:'sun_bell', count:1}],
    reward: {items:['sun_bell'], exp:100},
    zone: 'greenhouse', trigger: 'complete:open_greenhouse'
  },
  evening_concert: {
    id: 'evening_concert', title: '🎵 Вечерний мяу-концерт',
    desc: 'Устрой концерт на крыльце вечером.',
    steps: [{desc:'Мяукни 5 раз вечером', target:'meow:porch', count:5}],
    reward: {items:['ribbon'], exp:20},
    zone: 'porch', trigger: 'start', timeReq: 'evening'
  },
  yard_party: {
    id: 'yard_party', title: '🎉 Праздник во дворе',
    desc: 'Лиза хочет устроить вечеринку! Собери всех друзей.',
    steps: [{desc:'Подружись со всеми NPC (3)', target:'friends', count:3}],
    reward: {items:['star_acorn','ribbon'], exp:50},
    zone: 'yard', trigger: 'complete:sticker_quest'
  },
  find_fireflies: {
    id: 'find_fireflies', title: '✨ Найти светлячков',
    desc: 'Ночью у пруда появляются светлячки.',
    steps: [{desc:'Найди светлячков ночью', target:'firefly_spot', count:1}],
    reward: {items:['star_acorn'], exp:25},
    zone: 'pond', trigger: 'start', timeReq: 'night'
  },
  help_ducks: {
    id: 'help_ducks', title: '🦆 Помочь уткам у пруда',
    desc: 'Утки запутались в траве у пруда.',
    steps: [{desc:'Собери траву у пруда', target:'rare_leaf', count:2}],
    reward: {items:['feather','feather'], exp:15},
    zone: 'pond', trigger: 'start'
  },
  explore_attic: {
    id: 'explore_attic', title: '🏠 Исследовать чердак',
    desc: 'На чердак давно никто не заходил.',
    steps: [{desc:'Исследуй чердак', target:'explore:attic', count:1}],
    reward: {items:['letter','coin'], exp:30, unlocks:'attic'},
    zone: 'attic', trigger: 'explore:barn'
  },
  open_basement: {
    id: 'open_basement', title: '🔑 Открыть подвал',
    desc: 'В подвале что-то есть. Прохор знает как войти.',
    steps: [{desc:'Узнай у Прохора о подвале', target:'talk:prokhor', count:1}, {desc:'Найди ключ подвала', target:'barn_key', count:1}],
    reward: {zone:'basement', exp:35},
    zone: 'basement', trigger: 'explore:house'
  },
  final_quest: {
    id: 'final_quest', title: '🏡 Вернуть уют дому',
    desc: 'Позвони в Солнечный колокольчик и собери всех друзей.',
    steps: [{desc:'Найди Солнечный колокольчик', target:'sun_bell', count:1}, {desc:'Подружись со всеми (5)', target:'friends', count:5}],
    reward: {items:['sun_bell'], exp:200, ending:true},
    zone: 'yard', trigger: 'complete:sun_bell_quest'
  },
};

// ============================================================
// GAME DATA: ACHIEVEMENTS
// ============================================================
const ACHIEVEMENTS = {
  first_meow: { id:'first_meow', name:'Первый мяу', icon:'😺', desc:'Мяукни первый раз' },
  first_friend: { id:'first_friend', name:'Первый друг', icon:'🤝', desc:'Подружись с первым NPC' },
  fisherman: { id:'fisherman', name:'Рыбак', icon:'🎣', desc:'Поймай рыбку у пруда' },
  explorer: { id:'explorer', name:'Исследователь', icon:'🗺️', desc:'Открой 5 зон' },
  grandma_fav: { id:'grandma_fav', name:'Любимец бабушки', icon:'👵', desc:'Стань другом Бабушки' },
  baron_friend: { id:'baron_friend', name:'Друг Барона', icon:'🐕', desc:'Подружись с Бароном' },
  secret_cat: { id:'secret_cat', name:'Тайный кот', icon:'🕵️', desc:'Найди тайный проход' },
  collector: { id:'collector', name:'Коллекционер', icon:'💎', desc:'Собери 5 блестяшек' },
  yard_hero: { id:'yard_hero', name:'Герой двора', icon:'🏆', desc:'Выполни 10 квестов' },
  night_hunter: { id:'night_hunter', name:'Ночной охотник', icon:'🌙', desc:'Найди светлячков ночью' },
  sunny_cat: { id:'sunny_cat', name:'Солнечный кот', icon:'☀️', desc:'Найди Солнечный колокольчик' },
  jump_master: { id:'jump_master', name:'Мастер прыжков', icon:'🐱', desc:'Прыгни 20 раз' },
  garden_expert: { id:'garden_expert', name:'Знаток сада', icon:'🌸', desc:'Побывай в саду 5 раз' },
  greenhouse_keeper: { id:'greenhouse_keeper', name:'Хранитель теплицы', icon:'🌿', desc:'Открой теплицу' },
  best_purr: { id:'best_purr', name:'Лучший мурлыка', icon:'💛', desc:'Мурлыкай 10 раз' },
  full_inventory: { id:'full_inventory', name:'Полный инвентарь', icon:'🎒', desc:'Собери 10 разных предметов' },
  all_friends: { id:'all_friends', name:'Все NPC друзья', icon:'👥', desc:'Подружись со всеми персонажами' },
  all_zones: { id:'all_zones', name:'Все зоны открыты', icon:'🗺️', desc:'Открой все зоны карты' },
  all_quests: { id:'all_quests', name:'Все квесты выполнены', icon:'📜', desc:'Выполни все задания' },
  true_master: { id:'true_master', name:'Настоящий хозяин двора', icon:'👑', desc:'Пройди игру до конца' },
};

// ============================================================
// WORLD ZONES
// ============================================================
const ZONES = {
  yard:       { id:'yard',        name:'Двор',            color:'#2d5a1b', unlocked:true,  x:600,  y:600  },
  porch:      { id:'porch',       name:'Крыльцо',         color:'#8B4513', unlocked:true,  x:800,  y:350  },
  vegetable_garden:{ id:'vegetable_garden', name:'Огород', color:'#4a7c59', unlocked:true,  x:200,  y:500  },
  garden:     { id:'garden',      name:'Сад',             color:'#3d8b37', unlocked:true,  x:1400, y:500  },
  barn:       { id:'barn',        name:'Сарай',           color:'#8B4513', unlocked:false, x:1300, y:1200 },
  well:       { id:'well',        name:'Колодец',         color:'#7f8c8d', unlocked:true,  x:400,  y:700  },
  fence:      { id:'fence',       name:'Забор',           color:'#795548', unlocked:true,  x:100,  y:600  },
  pond:       { id:'pond',        name:'Пруд',            color:'#2980b9', unlocked:true,  x:1800, y:900  },
  forest_path:{ id:'forest_path', name:'Лесная тропинка', color:'#27ae60', unlocked:false, x:2200, y:400  },
  meadow:     { id:'meadow',      name:'Поляна',          color:'#2ecc71', unlocked:false, x:2000, y:800  },
  greenhouse: { id:'greenhouse',  name:'Теплица',         color:'#1abc9c', unlocked:false, x:2200, y:1100 },
  attic:      { id:'attic',       name:'Чердак',          color:'#8e44ad', unlocked:false, x:800,  y:200  },
  basement:   { id:'basement',    name:'Подвал',          color:'#34495e', unlocked:false, x:700,  y:1400 },
  roof:       { id:'roof',        name:'Крыша',           color:'#c0392b', unlocked:false, x:900,  y:100  },
  cat_path:   { id:'cat_path',    name:'Кошачья тропа',   color:'#f39c12', unlocked:false, x:1100, y:1500 },
};

// ============================================================
// COLLECTIBLE ITEMS placed in world
// ============================================================
const WORLD_ITEMS = [
  {id:'wi1', item:'bowl',     x:650,  y:650,  zone:'yard',             collected:false},
  {id:'wi2', item:'fish',     x:1850, y:950,  zone:'pond',             collected:false},
  {id:'wi3', item:'feather',  x:1450, y:500,  zone:'garden',           collected:false},
  {id:'wi4', item:'pebble',   x:700,  y:750,  zone:'yard',             collected:false},
  {id:'wi5', item:'pebble',   x:1200, y:900,  zone:'yard',             collected:false},
  {id:'wi6', item:'pebble',   x:250,  y:600,  zone:'vegetable_garden', collected:false},
  {id:'wi7', item:'pebble',   x:1600, y:800,  zone:'garden',           collected:false},
  {id:'wi8', item:'pebble',   x:450,  y:350,  zone:'well',             collected:false},
  {id:'wi9', item:'barn_key', x:300,  y:550,  zone:'vegetable_garden', collected:false},
  {id:'wi10',item:'apple',    x:1500, y:480,  zone:'garden',           collected:false},
  {id:'wi11',item:'apple',    x:1600, y:520,  zone:'garden',           collected:false},
  {id:'wi12',item:'apple',    x:1400, y:560,  zone:'garden',           collected:false},
  {id:'wi13',item:'coin',     x:900,  y:700,  zone:'yard',             collected:false},
  {id:'wi14',item:'button',   x:800,  y:900,  zone:'yard',             collected:false},
  {id:'wi15',item:'button',   x:1100, y:700,  zone:'yard',             collected:false},
  {id:'wi16',item:'button',   x:600,  y:500,  zone:'yard',             collected:false},
  {id:'wi17',item:'glasses',  x:1550, y:450,  zone:'garden',           collected:false},
  {id:'wi18',item:'cassette', x:1350, y:1250, zone:'barn',             collected:false},
  {id:'wi19',item:'pick',     x:1900, y:900,  zone:'pond',             collected:false},
  {id:'wi20',item:'stickers', x:750,  y:800,  zone:'yard',             collected:false},
  {id:'wi21',item:'stickers', x:950,  y:950,  zone:'yard',             collected:false},
  {id:'wi22',item:'stickers', x:550,  y:850,  zone:'yard',             collected:false},
  {id:'wi23',item:'stickers', x:1250, y:800,  zone:'yard',             collected:false},
  {id:'wi24',item:'stickers', x:1100, y:1050, zone:'yard',             collected:false},
  {id:'wi25',item:'diary_page',x:850, y:700,  zone:'yard',             collected:false},
  {id:'wi26',item:'diary_page',x:600, y:900,  zone:'yard',             collected:false},
  {id:'wi27',item:'diary_page',x:1000,y:1100, zone:'yard',             collected:false},
  {id:'wi28',item:'flashlight_part',x:1350,y:1150,zone:'barn',         collected:false},
  {id:'wi29',item:'flashlight_part',x:1400,y:1300,zone:'barn',         collected:false},
  {id:'wi30',item:'rare_leaf', x:1950, y:950, zone:'pond',             collected:false},
  {id:'wi31',item:'rare_leaf', x:1750, y:850, zone:'pond',             collected:false},
  {id:'wi32',item:'letter',    x:850,  y:200, zone:'attic',            collected:false},
  {id:'wi33',item:'letter',    x:900,  y:300, zone:'attic',            collected:false},
  {id:'wi34',item:'moon_bell', x:2100, y:900, zone:'meadow',           collected:false},
  {id:'wi35',item:'star_acorn',x:2300, y:500, zone:'forest_path',      collected:false},
  {id:'wi36',item:'dry_food',  x:700,  y:350, zone:'porch',            collected:false},
  {id:'wi37',item:'yarn',      x:650,  y:400, zone:'yard',             collected:false},
  {id:'wi38',item:'toy_mouse', x:1450, y:1300,zone:'barn',             collected:false},
  {id:'wi39',item:'sun_bell',  x:2250, y:1150,zone:'greenhouse',       collected:false},
];

// ============================================================
// WORLD OBJECTS (interactive things)
// ============================================================
const WORLD_OBJECTS = [
  {id:'house',    type:'house',      x:700,  y:200,  w:300, h:200, name:'Дом',      action:'explore', zone:'yard'},
  {id:'barn_obj', type:'barn',       x:1300, y:1150, w:200, h:160, name:'Сарай',    action:'enter',  zone:'yard', reqZone:'barn'},
  {id:'well_obj', type:'well',       x:380,  y:680,  w:60,  h:70,  name:'Колодец', action:'look',   zone:'yard'},
  {id:'pond_obj', type:'pond',       x:1700, y:850,  w:300, h:200, name:'Пруд',    action:'fish',   zone:'yard'},
  {id:'gh_obj',   type:'greenhouse', x:2150, y:1050, w:200, h:150, name:'Теплица', action:'enter',  zone:'meadow', reqZone:'greenhouse'},
  {id:'fence_obj',type:'fence',      x:100,  y:500,  w:50,  h:400, name:'Забор',   action:'look',   zone:'yard'},
  {id:'campfire', type:'campfire',   x:850,  y:750,  w:50,  h:50,  name:'Костёр', action:'warm',   zone:'yard'},
  {id:'cat_corner',type:'cat_corner',x:780,  y:430,  w:70,  h:50,  name:'Кошачий уголок', action:'rest', zone:'porch'},
  {id:'gate_obj', type:'gate',       x:100,  y:400,  w:80,  h:80,  name:'Ворота',  action:'look',   zone:'fence'},
];


// ============================================================
// DRAWING FUNCTIONS - Beautiful cozy visuals
// ============================================================
const Draw = {
  // Draw orange cat (Ryzhik)
  drawCat(ctx, x, y, dir, frame, isMoving, isSitting, isSleeping, scale=1) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    const t = frame * 0.1;
    const tailWag = Math.sin(t * 2) * 12;
    const bodyBob = isMoving ? Math.sin(t * 4) * 2 : 0;
    const legCycle = isMoving ? t : 0;

    if (isSleeping) {
      // Sleeping position
      ctx.save();
      ctx.translate(0, 6);
      // Body curled
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e8763a';
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.ellipse(14, -5, 10, 9, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#e8763a';
      ctx.fill();
      // Ear
      ctx.beginPath();
      ctx.moveTo(18,-12); ctx.lineTo(22,-6); ctx.lineTo(14,-8);
      ctx.fillStyle = '#e8763a'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(18,-11); ctx.lineTo(21,-7); ctx.lineTo(15,-8);
      ctx.fillStyle = '#ffb07c'; ctx.fill();
      // Eye closed
      ctx.beginPath();
      ctx.arc(17,-5,0.8,0,Math.PI);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.stroke();
      // Zzz
      ctx.fillStyle = 'rgba(200,220,255,0.8)';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('z', 24, -14);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('z', 28, -20);
      ctx.restore();
      ctx.restore();
      return;
    }

    const sitY = isSitting ? 4 : 0;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 18 + sitY, 16, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // Tail
    if (!isSitting) {
      ctx.beginPath();
      ctx.moveTo(-14, 8 + bodyBob);
      ctx.bezierCurveTo(-28, 0, -30 + tailWag, -20 + tailWag * 0.5, -20 + tailWag * 0.8, -28 + tailWag);
      ctx.strokeStyle = '#e8763a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Tail tip
      ctx.beginPath();
      ctx.arc(-20 + tailWag * 0.8, -28 + tailWag, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f99457';
      ctx.fill();
    } else {
      // Sitting tail wraps around
      ctx.beginPath();
      ctx.moveTo(-12, 12);
      ctx.bezierCurveTo(-24, 18, -20, 30, -4, 26);
      ctx.strokeStyle = '#e8763a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Legs
    if (!isSitting) {
      const leg1 = Math.sin(legCycle) * 5;
      const leg2 = Math.sin(legCycle + Math.PI) * 5;
      // Back legs
      ctx.beginPath(); ctx.ellipse(-8, 12 + leg1, 4, 6, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#d4642a'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(-1, 13 + leg2, 4, 6, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#d4642a'; ctx.fill();
      // Front legs
      ctx.beginPath(); ctx.ellipse(7, 11 + leg2, 3.5, 5.5, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#d4642a'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(12, 12 + leg1, 3.5, 5.5, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#d4642a'; ctx.fill();
      // Paws
      const paws = [[-8, 17+leg1], [-1, 18+leg2], [7,16+leg2], [12,17+leg1]];
      paws.forEach(([px,py]) => {
        ctx.beginPath(); ctx.ellipse(px, py+bodyBob, 4, 2.5, 0, 0, Math.PI*2);
        ctx.fillStyle = '#c55a25'; ctx.fill();
      });
    } else {
      // Sitting paws
      ctx.beginPath(); ctx.ellipse(-6, 14, 4, 3, 0, 0, Math.PI*2);
      ctx.fillStyle = '#c55a25'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, 14, 4, 3, 0, 0, Math.PI*2);
      ctx.fillStyle = '#c55a25'; ctx.fill();
    }

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 3 + bodyBob + sitY, 15, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e8763a';
    ctx.fill();
    // Belly fur
    ctx.beginPath();
    ctx.ellipse(2, 5 + bodyBob + sitY, 9, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f99457';
    ctx.fill();
    // Stripes on body
    ctx.strokeStyle = 'rgba(180,80,20,0.3)';
    ctx.lineWidth = 1.5;
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath();
      ctx.moveTo(s * 7, -3 + bodyBob + sitY);
      ctx.lineTo(s * 6, 8 + bodyBob + sitY);
      ctx.stroke();
    }

    // Head
    ctx.beginPath();
    ctx.ellipse(0, -10 + bodyBob, 13, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e8763a';
    ctx.fill();
    // Face fur
    ctx.beginPath();
    ctx.ellipse(0, -9 + bodyBob, 9, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f99457';
    ctx.fill();

    // Ears
    ctx.beginPath(); ctx.moveTo(-10,-19+bodyBob); ctx.lineTo(-15,-26+bodyBob); ctx.lineTo(-4,-22+bodyBob); ctx.closePath();
    ctx.fillStyle = '#e8763a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10,-19+bodyBob); ctx.lineTo(-14,-25+bodyBob); ctx.lineTo(-5,-21+bodyBob); ctx.closePath();
    ctx.fillStyle = '#ffb07c'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(10,-19+bodyBob); ctx.lineTo(15,-26+bodyBob); ctx.lineTo(4,-22+bodyBob); ctx.closePath();
    ctx.fillStyle = '#e8763a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(10,-19+bodyBob); ctx.lineTo(14,-25+bodyBob); ctx.lineTo(5,-21+bodyBob); ctx.closePath();
    ctx.fillStyle = '#ffb07c'; ctx.fill();

    // Eyes
    ctx.beginPath(); ctx.ellipse(-5, -11+bodyBob, 3.5, 3, 0, 0, Math.PI*2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -11+bodyBob, 3.5, 3, 0, 0, Math.PI*2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4.5, -11+bodyBob, 2.2, 2.8, 0, 0, Math.PI*2);
    ctx.fillStyle = '#2d6a2d'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5, -11+bodyBob, 2.2, 2.8, 0, 0, Math.PI*2);
    ctx.fillStyle = '#2d6a2d'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4.5, -11.5+bodyBob, 1.4, 1.8, 0.1, 0, Math.PI*2);
    ctx.fillStyle = '#1a1a1a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5, -11.5+bodyBob, 1.4, 1.8, -0.1, 0, Math.PI*2);
    ctx.fillStyle = '#1a1a1a'; ctx.fill();
    // Eye shine
    ctx.beginPath(); ctx.arc(-3.8, -12.5+bodyBob, 0.6, 0, Math.PI*2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.arc(6.2, -12.5+bodyBob, 0.6, 0, Math.PI*2);
    ctx.fillStyle = 'white'; ctx.fill();

    // Nose
    ctx.beginPath(); ctx.ellipse(0, -7.5+bodyBob, 2.5, 1.8, 0, 0, Math.PI*2);
    ctx.fillStyle = '#d4614a'; ctx.fill();
    // Mouth
    ctx.beginPath();
    ctx.moveTo(-1.5, -6+bodyBob); ctx.lineTo(-3, -5+bodyBob);
    ctx.moveTo(-1.5, -6+bodyBob); ctx.lineTo(0, -5.5+bodyBob);
    ctx.moveTo(1.5, -6+bodyBob); ctx.lineTo(3, -5+bodyBob);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8; ctx.stroke();
    // Whiskers
    ctx.strokeStyle = 'rgba(50,50,50,0.5)';
    ctx.lineWidth = 0.7;
    [[-1,-1,1],[0,0,0],[1,1,-1]].forEach(([dy1,dy2,dy3]) => {
      ctx.beginPath(); ctx.moveTo(-4, -7+dy1+bodyBob); ctx.lineTo(-15, -8+dy1+bodyBob); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(-4,-7.5+bodyBob); ctx.lineTo(-16,-7.5+bodyBob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4,-6.5+bodyBob); ctx.lineTo(-15,-5+bodyBob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-7+bodyBob); ctx.lineTo(15,-8+bodyBob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-7.5+bodyBob); ctx.lineTo(16,-7.5+bodyBob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-6.5+bodyBob); ctx.lineTo(15,-5+bodyBob); ctx.stroke();

    ctx.restore();
  },

  // Draw human NPC
  drawHumanNPC(ctx, npc, frame, scale=1) {
    const {x, y, id} = npc;
    const data = NPC_DATA[id];
    if (!data || data.isAnimal) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bob = Math.sin(frame * 0.08) * 1.5;
    const armSwing = Math.sin(frame * 0.08) * 8;

    const skin = data.skinColor || '#fcd1a0';
    const cloth = data.clothColor || '#74b9ff';
    const hair = data.hairColor || '#333';

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 22, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // Shoes
    ctx.beginPath(); ctx.ellipse(-5, 22+bob, 5, 2.5, 0, 0, Math.PI*2);
    ctx.fillStyle = '#2c3e50'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 22+bob, 5, 2.5, 0, 0, Math.PI*2);
    ctx.fillStyle = '#2c3e50'; ctx.fill();

    // Legs
    ctx.beginPath();
    ctx.moveTo(-5, 6+bob); ctx.lineTo(-5, 22+bob);
    ctx.strokeStyle = (id === 'lyokha' || id === 'sonya') ? '#dfe6e9' : (id === 'igor' ? '#1a1a1a' : '#607d8b');
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, 6+bob); ctx.lineTo(5, 22+bob);
    ctx.stroke();

    // Body / torso
    ctx.beginPath();
    ctx.roundRect(-9, -8+bob, 18, 18, [4]);
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Body detail (collar / pattern)
    if (id === 'igor') {
      ctx.beginPath(); ctx.moveTo(-3,-8+bob); ctx.lineTo(0,-4+bob); ctx.lineTo(3,-8+bob);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
      // Chain
      ctx.beginPath(); ctx.arc(0, -1+bob, 3, 0, Math.PI*2);
      ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (id === 'nastya') {
      ctx.beginPath(); ctx.ellipse(0,-3+bob,3,2,0,0,Math.PI*2);
      ctx.fillStyle = 'rgba(255,100,130,0.4)'; ctx.fill();
    }
    if (id === 'liza') {
      // Accessories
      ctx.beginPath(); ctx.arc(-3,-2+bob,2,0,Math.PI*2);
      ctx.fillStyle = 'rgba(255,220,100,0.7)'; ctx.fill();
      ctx.beginPath(); ctx.arc(3,-2+bob,2,0,Math.PI*2);
      ctx.fillStyle = 'rgba(255,100,200,0.7)'; ctx.fill();
    }

    // Arms
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9,-4+bob); ctx.lineTo(-16,4+bob+armSwing*0.3);
    ctx.strokeStyle = cloth; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9,-4+bob); ctx.lineTo(16,4+bob-armSwing*0.3);
    ctx.stroke();
    // Hands
    ctx.beginPath(); ctx.arc(-16,4+bob+armSwing*0.3,3,0,Math.PI*2);
    ctx.fillStyle = skin; ctx.fill();
    ctx.beginPath(); ctx.arc(16,4+bob-armSwing*0.3,3,0,Math.PI*2);
    ctx.fillStyle = skin; ctx.fill();

    // Tattoos (Prokhor, Kristina)
    if (id === 'prokhor' || id === 'kristina') {
      ctx.strokeStyle = 'rgba(0,0,150,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(-15,2+bob,4,0,Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(15,2+bob,4,0,Math.PI); ctx.stroke();
    }

    // Neck
    ctx.beginPath(); ctx.ellipse(0,-9+bob,4,3,0,0,Math.PI*2);
    ctx.fillStyle = skin; ctx.fill();

    // Head
    ctx.beginPath(); ctx.ellipse(0,-18+bob,10,11,0,0,Math.PI*2);
    ctx.fillStyle = skin; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Hair
    ctx.beginPath();
    if (id === 'lyokha') {
      ctx.ellipse(0,-22+bob,10,7,0,Math.PI,Math.PI*2);
    } else if (id === 'igor' || id === 'prokhor') {
      ctx.ellipse(0,-22+bob,10,7,0,Math.PI,Math.PI*2);
    } else if (id === 'nastya' || id === 'sonya' || id === 'nena') {
      ctx.ellipse(0,-22+bob,10,7,0,Math.PI,Math.PI*2);
      ctx.fillStyle = hair; ctx.fill();
      // Long hair
      ctx.beginPath();
      ctx.moveTo(-10,-18+bob); ctx.bezierCurveTo(-14,-10+bob,-13,4+bob,-10,10+bob);
      ctx.moveTo(10,-18+bob); ctx.bezierCurveTo(14,-10+bob,13,4+bob,10,10+bob);
      ctx.strokeStyle = hair; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
    } else if (id === 'liza') {
      ctx.ellipse(0,-22+bob,11,8,0,Math.PI,Math.PI*2);
    } else {
      ctx.ellipse(0,-22+bob,10,7,0,Math.PI,Math.PI*2);
    }
    ctx.fillStyle = hair; ctx.fill();

    // Hat (Mag, Danya)
    if (id === 'mag') {
      ctx.beginPath();
      ctx.moveTo(-10,-24+bob); ctx.lineTo(-8,-40+bob); ctx.lineTo(8,-40+bob); ctx.lineTo(10,-24+bob);
      ctx.fillStyle = '#1a1a2e'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0,-24+bob,12,4,0,0,Math.PI*2);
      ctx.fillStyle = '#16213e'; ctx.fill();
      // Stars on hat
      ctx.fillStyle = 'rgba(200,220,255,0.6)';
      [[0,-32],[5,-28],[-4,-30]].forEach(([sx,sy]) => {
        ctx.beginPath(); ctx.arc(sx,sy+bob,1,0,Math.PI*2); ctx.fill();
      });
    }
    if (id === 'danya') {
      ctx.beginPath(); ctx.ellipse(0,-24+bob,11,5,0,Math.PI,Math.PI*2);
      ctx.fillStyle = '#e74c3c'; ctx.fill();
      ctx.beginPath(); ctx.rect(-11,-24+bob,22,3);
      ctx.fillStyle = '#c0392b'; ctx.fill();
    }
    // Glasses
    if (id === 'nena' || id === 'danya') {
      const gc = id === 'danya' ? '#e74c3c' : '#333';
      ctx.strokeStyle = gc; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-4,-18+bob,3,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(4,-18+bob,3,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1,-18+bob); ctx.lineTo(1,-18+bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7,-18+bob); ctx.lineTo(-9,-17+bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7,-18+bob); ctx.lineTo(9,-17+bob); ctx.stroke();
    }

    // Eyes
    const eyeY = -19+bob;
    ctx.beginPath(); ctx.ellipse(-4,eyeY,2,2.2,0,0,Math.PI*2);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(4,eyeY,2,2.2,0,0,Math.PI*2);
    ctx.fillStyle = 'white'; ctx.fill();
    const irisC = id === 'nastya' || id === 'sonya' ? '#27ae60' : id === 'lyokha' ? '#2980b9' : '#5d4037';
    ctx.beginPath(); ctx.ellipse(-4,eyeY,1.2,1.5,0,0,Math.PI*2);
    ctx.fillStyle = irisC; ctx.fill();
    ctx.beginPath(); ctx.ellipse(4,eyeY,1.2,1.5,0,0,Math.PI*2);
    ctx.fillStyle = irisC; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4,eyeY,0.7,0.9,0,0,Math.PI*2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(4,eyeY,0.7,0.9,0,0,Math.PI*2);
    ctx.fillStyle = '#111'; ctx.fill();
    // Shine
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-3.4,eyeY-0.6,0.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(4.6,eyeY-0.6,0.4,0,Math.PI*2); ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.arc(0,-16+bob,2.5,0.2,Math.PI-0.2);
    ctx.strokeStyle = 'rgba(120,60,50,0.6)'; ctx.lineWidth = 1; ctx.stroke();

    // Accessories
    if (id === 'nastya') {
      ctx.fillStyle = '#e84393';
      ctx.beginPath(); ctx.ellipse(-1,-15+bob,1.5,0.8,0,0,Math.PI*2); ctx.fill();
    }
    if (id === 'prokhor') {
      // Mustache
      ctx.beginPath();
      ctx.moveTo(-4,-16+bob); ctx.bezierCurveTo(-6,-14+bob,-4,-13+bob,-1,-15+bob);
      ctx.moveTo(4,-16+bob); ctx.bezierCurveTo(6,-14+bob,4,-13+bob,1,-15+bob);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Backpack (Sonya)
    if (id === 'sonya') {
      ctx.beginPath();
      ctx.roundRect(9,-6+bob,8,12,[3]);
      ctx.fillStyle = '#2ecc71'; ctx.fill();
      ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // Notebook (Nena)
    if (id === 'nena') {
      ctx.beginPath(); ctx.roundRect(-20,0+bob,10,13,[2]);
      ctx.fillStyle = '#ecf0f1'; ctx.fill();
      ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 0.8; ctx.stroke();
    }

    // Name badge
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const nameW = data.name.length * 5.5 + 8;
    ctx.beginPath(); ctx.roundRect(-nameW/2,-34+bob,nameW,12,[4]);
    ctx.fill();
    ctx.fillStyle = data.color || '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.name, 0, -25+bob);

    ctx.restore();
  },

  drawAnimalNPC(ctx, npc, frame) {
    const {x, y, id} = npc;
    const data = NPC_DATA[id];
    ctx.save();
    ctx.translate(x, y);

    if (data.animalType === 'dog') {
      // Baron the dog
      const bob = Math.sin(frame*0.08)*1.5;
      ctx.beginPath(); ctx.ellipse(0,0,16,10,0,0,Math.PI*2);
      ctx.fillStyle = '#7f8c8d'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(14,-5,11,10,0,0,Math.PI*2);
      ctx.fillStyle = '#7f8c8d'; ctx.fill();
      // Ears floppy
      ctx.beginPath(); ctx.ellipse(10,-12+bob,5,8,0.3,0,Math.PI*2);
      ctx.fillStyle = '#636e72'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(20,-12+bob,5,8,0.3,0,Math.PI*2);
      ctx.fillStyle = '#636e72'; ctx.fill();
      // Eyes
      ctx.beginPath(); ctx.arc(11,-5,3,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
      ctx.beginPath(); ctx.arc(19,-5,3,0,Math.PI*2); ctx.fillStyle='white'; ctx.fill();
      ctx.beginPath(); ctx.arc(11.5,-5,1.8,0,Math.PI*2); ctx.fillStyle='#333'; ctx.fill();
      ctx.beginPath(); ctx.arc(19.5,-5,1.8,0,Math.PI*2); ctx.fillStyle='#333'; ctx.fill();
      // Nose
      ctx.beginPath(); ctx.ellipse(17,0,3,2,0,0,Math.PI*2); ctx.fillStyle='#333'; ctx.fill();
      // Tail
      ctx.beginPath(); ctx.moveTo(-14,0); ctx.bezierCurveTo(-22,-8,-24,-18,-18,-20+Math.sin(frame*0.2)*8);
      ctx.strokeStyle='#7f8c8d'; ctx.lineWidth=4; ctx.lineCap='round'; ctx.stroke();
      // Name
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(-14,-22,28,11,[4]); ctx.fill();
      ctx.fillStyle=data.color||'#fff'; ctx.font='bold 7px sans-serif'; ctx.textAlign='center';
      ctx.fillText(data.name,0,-14);
    } else if (data.animalType === 'cat') {
      // Musy the cat
      Draw.drawCat(ctx, 0, 0, 1, frame, false, true, false, 0.7);
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(-14,-28,28,11,[4]); ctx.fill();
      ctx.fillStyle=data.color||'#fff'; ctx.font='bold 7px sans-serif'; ctx.textAlign='center';
      ctx.fillText(data.name,0,-20);
    }
    ctx.restore();
  },

  drawHouse(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    // Shadow
    ctx.beginPath(); ctx.ellipse(0,95,140,20,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fill();
    // Main walls
    ctx.beginPath(); ctx.roundRect(-120,0,240,120,[6]);
    ctx.fillStyle='#e8d5b0'; ctx.fill();
    ctx.strokeStyle='#c4a876'; ctx.lineWidth=2; ctx.stroke();
    // Roof
    ctx.beginPath();
    ctx.moveTo(-135,5); ctx.lineTo(0,-80); ctx.lineTo(135,5);
    ctx.fillStyle='#c0392b'; ctx.fill();
    ctx.strokeStyle='#a93226'; ctx.lineWidth=2; ctx.stroke();
    // Roof tiles detail
    ctx.strokeStyle='rgba(169,50,38,0.5)'; ctx.lineWidth=1;
    for(let tx=-120;tx<135;tx+=20){
      ctx.beginPath(); ctx.moveTo(tx,5); ctx.lineTo(tx+10,-80*Math.abs(tx)/135-5);
      ctx.stroke();
    }
    // Door
    ctx.beginPath(); ctx.roundRect(-22,50,44,70,[6,6,0,0]);
    ctx.fillStyle='#8B4513'; ctx.fill();
    ctx.strokeStyle='#5D2E0C'; ctx.lineWidth=1.5; ctx.stroke();
    // Door knob
    ctx.beginPath(); ctx.arc(14,85,3,0,Math.PI*2);
    ctx.fillStyle='#f0c040'; ctx.fill();
    // Windows
    [['-80','20'],['60','20']].forEach(([wx,wy])=>{
      const wxi=parseInt(wx), wyi=parseInt(wy);
      ctx.beginPath(); ctx.roundRect(wxi,wyi,50,40,[4]);
      ctx.fillStyle='rgba(200,230,255,0.6)'; ctx.fill();
      ctx.strokeStyle='#c4a876'; ctx.lineWidth=1.5; ctx.stroke();
      // Cross
      ctx.beginPath(); ctx.moveTo(wxi+25,wyi); ctx.lineTo(wxi+25,wyi+40);
      ctx.moveTo(wxi,wyi+20); ctx.lineTo(wxi+50,wyi+20);
      ctx.strokeStyle='rgba(196,168,118,0.6)'; ctx.lineWidth=1; ctx.stroke();
      // Light glow at evening
    });
    // Chimney
    ctx.beginPath(); ctx.roundRect(60,-80,20,40,[3]);
    ctx.fillStyle='#c4a876'; ctx.fill();
    ctx.strokeStyle='#a87f50'; ctx.lineWidth=1.5; ctx.stroke();
    // Porch
    ctx.beginPath(); ctx.rect(-60,115,120,10);
    ctx.fillStyle='#c4a876'; ctx.fill();
    // Steps
    ctx.beginPath(); ctx.rect(-30,120,60,10); ctx.fillStyle='#d4b896'; ctx.fill();
    ctx.beginPath(); ctx.rect(-20,128,40,8); ctx.fillStyle='#c4a876'; ctx.fill();
    ctx.restore();
  },

  drawTrees(ctx, treeData) {
    treeData.forEach(t => {
      ctx.save();
      ctx.translate(t.x, t.y);
      const swayAmt = Math.sin(Date.now()*0.001 + t.x*0.01) * 1.5;
      ctx.rotate(swayAmt * Math.PI/180);
      // Shadow
      ctx.beginPath(); ctx.ellipse(0,t.h*0.1,t.r*0.8,t.r*0.25,0,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
      // Trunk
      ctx.beginPath(); ctx.roundRect(-6,-t.h*0.35,12,t.h*0.4,[3]);
      ctx.fillStyle='#795548'; ctx.fill();
      ctx.strokeStyle='#5d3a1a'; ctx.lineWidth=1; ctx.stroke();
      // Foliage layers
      const colors = t.type==='apple' ? ['#2e7d32','#388e3c','#43a047','#4caf50'] : ['#1b5e20','#2e7d32','#388e3c','#43a047'];
      const leafColors = t.type==='apple' ? colors : colors;
      [[0,-t.h,t.r],[0,-t.h*0.75,t.r*0.9],[0,-t.h*0.5,t.r*0.8]].forEach(([lx,ly,lr],i)=>{
        ctx.beginPath(); ctx.arc(lx+swayAmt*0.5,ly,lr,0,Math.PI*2);
        ctx.fillStyle=leafColors[i]||leafColors[0]; ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=0.5; ctx.stroke();
      });
      // Apples
      if(t.type==='apple'){
        for(let a=0;a<4;a++){
          const ax=Math.cos(a*1.6)*t.r*0.5+swayAmt*0.3;
          const ay=Math.sin(a*1.6)*t.r*0.3-t.h*0.65;
          ctx.beginPath(); ctx.arc(ax,ay,4,0,Math.PI*2);
          ctx.fillStyle='#e74c3c'; ctx.fill();
          ctx.strokeStyle='#c0392b'; ctx.lineWidth=0.5; ctx.stroke();
        }
      }
      ctx.restore();
    });
  },

  drawGrass(ctx, x, y, w, h, seed) {
    // Multi-shade grass
    const grad = ctx.createLinearGradient(x, y, x, y+h);
    grad.addColorStop(0, '#3d8b37');
    grad.addColorStop(0.5, '#2d7a28');
    grad.addColorStop(1, '#1e5c1a');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Grass blades
    ctx.strokeStyle = 'rgba(100,200,80,0.3)';
    ctx.lineWidth = 1;
    const rng = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
    for (let i = 0; i < 60; i++) {
      const gx = x + rng(seed+i*7) * w;
      const gy = y + rng(seed+i*11) * h;
      const gh = 8 + rng(seed+i*13) * 8;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.bezierCurveTo(gx-2,gy-gh*0.4, gx+rng(seed+i)*6-3,gy-gh*0.8, gx+rng(seed+i*5)*4-2,gy-gh);
      ctx.stroke();
    }
  },

  drawPond(ctx, x, y, rx, ry, t) {
    // Water base
    const grad = ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));
    grad.addColorStop(0, '#1e88e5');
    grad.addColorStop(0.6, '#1565c0');
    grad.addColorStop(1, '#0d47a1');
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle='#42a5f5'; ctx.lineWidth=2; ctx.stroke();
    // Ripples
    for(let r=1;r<=3;r++){
      const rf = (t*0.02+r*0.3) % 1;
      ctx.beginPath(); ctx.ellipse(x,y,rx*0.3*rf+15,ry*0.3*rf+10,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(100,180,255,${0.4*(1-rf)})`; ctx.lineWidth=1.5; ctx.stroke();
    }
    // Reflection shimmer
    ctx.beginPath();
    ctx.ellipse(x-rx*0.2, y-ry*0.2, rx*0.25, ry*0.15, -0.2, 0, Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fill();
    // Lily pads
    [[x-rx*0.3,y+ry*0.1],[x+rx*0.25,y-ry*0.2],[x-rx*0.1,y-ry*0.3]].forEach(([lx,ly])=>{
      ctx.beginPath(); ctx.ellipse(lx,ly,10,7,Math.sin(t*0.01+lx)*0.3,0,Math.PI*2);
      ctx.fillStyle='#2e7d32'; ctx.fill();
      ctx.strokeStyle='#1b5e20'; ctx.lineWidth=0.5; ctx.stroke();
    });
  },

  drawGreenhouse(ctx, x, y, unlocked) {
    ctx.save();
    ctx.translate(x, y);
    // Shadow
    ctx.beginPath(); ctx.ellipse(0,90,80,15,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
    // Frame
    ctx.beginPath(); ctx.rect(-70,0,140,90);
    ctx.fillStyle=unlocked?'rgba(180,230,200,0.3)':'rgba(150,150,150,0.2)';
    ctx.fill();
    ctx.strokeStyle=unlocked?'#4db6ac':'#78909c'; ctx.lineWidth=3; ctx.stroke();
    // Roof triangle
    ctx.beginPath(); ctx.moveTo(-75,0); ctx.lineTo(0,-60); ctx.lineTo(75,0);
    ctx.closePath();
    ctx.fillStyle=unlocked?'rgba(180,230,200,0.2)':'rgba(150,150,150,0.15)'; ctx.fill();
    ctx.strokeStyle=unlocked?'#4db6ac':'#78909c'; ctx.lineWidth=3; ctx.stroke();
    // Glass panes
    ctx.strokeStyle=unlocked?'rgba(128,222,234,0.4)':'rgba(180,180,180,0.3)';
    ctx.lineWidth=1;
    for(let gp=-60;gp<70;gp+=20){
      ctx.beginPath(); ctx.moveTo(gp,0); ctx.lineTo(gp,90); ctx.stroke();
    }
    // Glowing plants inside if unlocked
    if(unlocked){
      ctx.fillStyle='rgba(100,220,100,0.15)';
      ctx.fillRect(-65,40,130,50);
      for(let p=-50;p<60;p+=15){
        ctx.beginPath(); ctx.moveTo(p,90); ctx.bezierCurveTo(p-5,70,p+5,55,p,45);
        ctx.strokeStyle=`rgba(100,200,80,${0.3+Math.random()*0.3})`; ctx.lineWidth=2; ctx.stroke();
      }
    } else {
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(-20,30,40,30,[5]);
      ctx.fill();
      ctx.fillStyle='rgba(255,200,50,0.7)';
      ctx.font='bold 20px sans-serif'; ctx.textAlign='center';
      ctx.fillText('🔒',0,54);
    }
    ctx.restore();
  },

  drawBarn(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.ellipse(0,80,80,12,0,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
    // Walls
    ctx.beginPath(); ctx.rect(-70,0,140,90);
    ctx.fillStyle='#8B4513'; ctx.fill();
    ctx.strokeStyle='#5D2E0C'; ctx.lineWidth=2; ctx.stroke();
    // Roof
    ctx.beginPath(); ctx.moveTo(-80,-5); ctx.lineTo(0,-55); ctx.lineTo(80,-5); ctx.closePath();
    ctx.fillStyle='#c0392b'; ctx.fill();
    ctx.strokeStyle='#922b21'; ctx.lineWidth=2; ctx.stroke();
    // Door
    ctx.beginPath(); ctx.roundRect(-30,25,60,65,[4,4,0,0]);
    ctx.fillStyle='#5D2E0C'; ctx.fill();
    // Door planks
    ctx.strokeStyle='#4a2000'; ctx.lineWidth=1;
    for(let dp=30;dp<80;dp+=10){ctx.beginPath();ctx.moveTo(-30,dp);ctx.lineTo(30,dp);ctx.stroke();}
    // Vertical beam
    ctx.beginPath(); ctx.moveTo(0,25); ctx.lineTo(0,90); ctx.strokeStyle='#4a2000'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
  },

  drawFence(ctx, points) {
    points.forEach(p => {
      const [fx,fy,fw,fh] = p;
      const postW = 8, postH = fh, boardH = fh * 0.6, spacing = 16;
      // Posts
      for(let px=fx;px<fx+fw;px+=spacing){
        ctx.beginPath(); ctx.roundRect(px-postW/2,fy,postW,postH,[2]);
        ctx.fillStyle='#a0522d'; ctx.fill();
        ctx.strokeStyle='#7B3A1F'; ctx.lineWidth=0.8; ctx.stroke();
        // Post cap
        ctx.beginPath(); ctx.moveTo(px-postW/2,fy); ctx.lineTo(px,fy-8); ctx.lineTo(px+postW/2,fy); ctx.closePath();
        ctx.fillStyle='#8B4513'; ctx.fill();
      }
      // Boards
      ctx.beginPath(); ctx.rect(fx,fy+8,fw,boardH-8);
      ctx.fillStyle='#c4a876'; ctx.fill();
      ctx.strokeStyle='#a87f50'; ctx.lineWidth=0.5; ctx.stroke();
    });
  },

  drawFlowers(ctx, flowerData, t) {
    flowerData.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      const sway = Math.sin(t * 0.002 + f.x * 0.05) * 3;
      ctx.rotate(sway * Math.PI / 180);
      // Stem
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-18);
      ctx.strokeStyle='#4caf50'; ctx.lineWidth=1.5; ctx.lineCap='round'; ctx.stroke();
      // Petals
      const pc = f.color || '#e91e63';
      for(let p=0;p<6;p++){
        const pa = (p/6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(pa)*5, -18+Math.sin(pa)*5, 4, 3, pa, 0, Math.PI*2);
        ctx.fillStyle=pc; ctx.fill();
      }
      // Center
      ctx.beginPath(); ctx.arc(0,-18,3.5,0,Math.PI*2);
      ctx.fillStyle='#fff176'; ctx.fill();
      ctx.restore();
    });
  },

  drawFireflies(ctx, fireflies, t) {
    fireflies.forEach(f => {
      const glow = (Math.sin(t * 0.05 + f.phase) + 1) * 0.5;
      const alpha = 0.3 + glow * 0.7;
      const radius = 2 + glow * 2;
      // Glow
      const g = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,radius*4);
      g.addColorStop(0, `rgba(200,255,100,${alpha*0.8})`);
      g.addColorStop(1, 'rgba(200,255,100,0)');
      ctx.beginPath(); ctx.arc(f.x,f.y,radius*4,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      // Core
      ctx.beginPath(); ctx.arc(f.x,f.y,radius,0,Math.PI*2);
      ctx.fillStyle=`rgba(220,255,150,${alpha})`; ctx.fill();
    });
  },

  drawClouds(ctx, clouds, t) {
    clouds.forEach(c => {
      ctx.save();
      ctx.globalAlpha = c.opacity || 0.7;
      ctx.translate(c.x + Math.sin(t*0.0005)*10, c.y);
      const r = c.r || 30;
      // Cloud puffs
      [[0,0,1],[r*0.5,-r*0.2,0.8],[r*-0.5,-r*0.15,0.75],[r*0.9,r*0.1,0.7],[r*-0.9,r*0.05,0.65]].forEach(([cx,cy,sc])=>{
        ctx.beginPath(); ctx.arc(cx,cy,r*sc,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fill();
      });
      ctx.restore();
    });
  },

  drawWeatherEffects(ctx, weather, particles, w, h) {
    if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(150,200,255,0.4)';
      ctx.lineWidth = 1;
      particles.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 3, p.y + p.vy * 3);
        ctx.stroke();
      });
    } else if (weather === 'fog') {
      const fg = ctx.createLinearGradient(0,0,w,h);
      fg.addColorStop(0,'rgba(200,220,200,0.2)');
      fg.addColorStop(0.5,'rgba(200,220,200,0.35)');
      fg.addColorStop(1,'rgba(200,220,200,0.2)');
      ctx.fillStyle = fg;
      ctx.fillRect(0,0,w,h);
    } else if (weather === 'wind') {
      ctx.strokeStyle = 'rgba(200,220,255,0.2)';
      ctx.lineWidth = 1.5;
      particles.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x,p.y);
        ctx.bezierCurveTo(p.x+20,p.y-5,p.x+30,p.y+5,p.x+40,p.y);
        ctx.stroke();
      });
    }
  },

  drawLightingOverlay(ctx, timeOfDay, w, h, x, y) {
    let overlay;
    if (timeOfDay === 'night') {
      overlay = 'rgba(5,10,40,0.65)';
    } else if (timeOfDay === 'evening') {
      overlay = 'rgba(180,80,20,0.2)';
    } else if (timeOfDay === 'morning') {
      overlay = 'rgba(255,220,100,0.08)';
    } else {
      return; // Day: no overlay
    }
    ctx.fillStyle = overlay;
    ctx.fillRect(x, y, w, h);
    // Moon at night
    if (timeOfDay === 'night') {
      ctx.beginPath();
      ctx.arc(x+w-80, y+60, 25, 0, Math.PI*2);
      const mg = ctx.createRadialGradient(x+w-80,y+60,0,x+w-80,y+60,25);
      mg.addColorStop(0,'rgba(255,250,200,0.9)');
      mg.addColorStop(1,'rgba(255,250,200,0.5)');
      ctx.fillStyle=mg; ctx.fill();
      // Moon glow
      const moonGlow = ctx.createRadialGradient(x+w-80,y+60,10,x+w-80,y+60,60);
      moonGlow.addColorStop(0,'rgba(255,250,200,0.1)');
      moonGlow.addColorStop(1,'rgba(255,250,200,0)');
      ctx.beginPath(); ctx.arc(x+w-80,y+60,60,0,Math.PI*2);
      ctx.fillStyle=moonGlow; ctx.fill();
    }
    // Stars at night
    if (timeOfDay === 'night') {
      const rng = (s) => { let v=Math.sin(s)*10000; return v-Math.floor(v); };
      ctx.fillStyle='rgba(255,255,255,0.8)';
      for(let s=0;s<40;s++){
        const sx=x+rng(s*7)*w, sy=y+rng(s*13)*h*0.5;
        const ss=0.5+rng(s*17)*2;
        const twinkle=(Math.sin(Date.now()*0.001+s)*0.3+0.7);
        ctx.globalAlpha=twinkle*0.7;
        ctx.beginPath(); ctx.arc(sx,sy,ss,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    // Sun
    if (timeOfDay === 'day' || timeOfDay === 'morning') {
      const sa = timeOfDay === 'morning' ? 0.7 : 0.5;
      const sx = x+80, sy = y+60;
      const sg = ctx.createRadialGradient(sx,sy,0,sx,sy,50);
      sg.addColorStop(0,`rgba(255,240,100,${sa})`);
      sg.addColorStop(1,'rgba(255,200,50,0)');
      ctx.beginPath(); ctx.arc(sx,sy,50,0,Math.PI*2);
      ctx.fillStyle=sg; ctx.fill();
      ctx.beginPath(); ctx.arc(sx,sy,18,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,250,150,${sa+0.1})`; ctx.fill();
    }
    // Sunset glow
    if (timeOfDay === 'evening') {
      const eg = ctx.createLinearGradient(x,y+h,x,y);
      eg.addColorStop(0,'rgba(200,80,20,0)');
      eg.addColorStop(0.3,'rgba(200,80,20,0.15)');
      eg.addColorStop(1,'rgba(255,120,30,0.25)');
      ctx.fillStyle=eg;
      ctx.fillRect(x,y,w,h);
    }
  },

  drawWindowLights(ctx, hx, hy, timeOfDay) {
    if (timeOfDay !== 'evening' && timeOfDay !== 'night') return;
    const alpha = timeOfDay === 'night' ? 0.7 : 0.4;
    const winPos = [{x:hx-80,y:hy+20},{x:hx+60,y:hy+20}];
    winPos.forEach(wp => {
      const wg = ctx.createRadialGradient(wp.x+25,wp.y+20,0,wp.x+25,wp.y+20,60);
      wg.addColorStop(0,`rgba(255,220,100,${alpha})`);
      wg.addColorStop(1,'rgba(255,220,100,0)');
      ctx.beginPath(); ctx.ellipse(wp.x+25,wp.y+20,60,40,0,0,Math.PI*2);
      ctx.fillStyle=wg; ctx.fill();
    });
  },

  drawCampfire(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    // Stones
    for(let s=0;s<6;s++){
      const sa=s/6*Math.PI*2, sr=12;
      ctx.beginPath(); ctx.ellipse(Math.cos(sa)*sr,Math.sin(sa)*sr*0.5,5,4,sa,0,Math.PI*2);
      ctx.fillStyle='#78909c'; ctx.fill();
    }
    // Logs
    ctx.beginPath(); ctx.roundRect(-10,0,20,5,[2]);
    ctx.fillStyle='#795548'; ctx.fill();
    ctx.save(); ctx.rotate(1.2);
    ctx.beginPath(); ctx.roundRect(-10,0,18,4,[2]);
    ctx.fillStyle='#6d4c41'; ctx.fill(); ctx.restore();
    // Flames
    for(let fl=0;fl<4;fl++){
      const fw=Math.sin(t*0.05+fl*1.2)*2, fh=10+fl*4;
      const ff=fl/4;
      const fg=ctx.createLinearGradient(fl*3-6,-fh-5,fl*3-6,0);
      fg.addColorStop(0,`rgba(255,255,100,0)`);
      fg.addColorStop(0.3,`rgba(255,180,0,0.8)`);
      fg.addColorStop(1,`rgba(220,50,0,0.9)`);
      ctx.beginPath();
      ctx.moveTo(fl*3-6+fw,0);
      ctx.bezierCurveTo(fl*3-8+fw,-fh*0.4,fl*3+2+fw,-fh*0.7,fl*3-3+fw,-fh-5);
      ctx.bezierCurveTo(fl*3+8+fw,-fh*0.8,fl*3+4+fw,-fh*0.4,fl*3+6+fw,-fh*0.1);
      ctx.closePath();
      ctx.fillStyle=fg; ctx.fill();
    }
    // Embers
    for(let e=0;e<5;e++){
      const ea=(t*0.05+e*1.3)%(Math.PI*2);
      const ex=Math.cos(ea)*8, ey=-Math.abs(Math.sin(ea))*20-5;
      ctx.beginPath(); ctx.arc(ex,ey,1,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,150,50,${0.5+Math.sin(ea)*0.5})`; ctx.fill();
    }
    ctx.restore();
  },

  drawPortrait(ctx, npcId, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x,y,w,h,[8]);
    ctx.clip();
    // Background
    const npc = NPC_DATA[npcId];
    if (!npc) {
      // Ryzhik portrait
      ctx.fillStyle = '#2d4a1e';
      ctx.fillRect(x,y,w,h);
      Draw.drawCat(ctx, x+w/2, y+h-12, 1, 0, false, true, false, 1.4);
      ctx.restore(); return;
    }
    ctx.fillStyle = npc.color ? npc.color + '22' : '#222';
    ctx.fillRect(x,y,w,h);
    // Draw mini portrait
    ctx.translate(x+w/2, y+h-10);
    ctx.scale(1.5, 1.5);
    Draw.drawHumanNPC(ctx, {...npc, x:0, y:0}, 0, 1);
    ctx.restore();
  },

  drawSun(ctx, x, y, t) {
    const pulse = 1 + Math.sin(t * 0.02) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    // Rays
    ctx.strokeStyle = 'rgba(255,220,50,0.4)';
    ctx.lineWidth = 2;
    for(let r=0;r<12;r++){
      const ra = r/12*Math.PI*2 + t*0.005;
      const rl = 35 + Math.sin(t*0.03+r)*5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra)*22*pulse, Math.sin(ra)*22*pulse);
      ctx.lineTo(Math.cos(ra)*rl*pulse, Math.sin(ra)*rl*pulse);
      ctx.stroke();
    }
    // Glow
    const sg = ctx.createRadialGradient(0,0,0,0,0,40*pulse);
    sg.addColorStop(0,'rgba(255,255,150,0.4)');
    sg.addColorStop(1,'rgba(255,200,50,0)');
    ctx.beginPath(); ctx.arc(0,0,40*pulse,0,Math.PI*2);
    ctx.fillStyle=sg; ctx.fill();
    // Core
    ctx.beginPath(); ctx.arc(0,0,20*pulse,0,Math.PI*2);
    ctx.fillStyle='#ffeb3b'; ctx.fill();
    ctx.strokeStyle='rgba(255,200,50,0.5)'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
  },
};

// ============================================================
// INPUT SYSTEM
// ============================================================
class Input {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this._bind();
  }
  _bind() {
    window.addEventListener('keydown', e => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }
  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) {
    if (this.justPressed[code]) { delete this.justPressed[code]; return true; }
    return false;
  }
  consume(code) { return this.wasPressed(code); }
  clearJust() { this.justPressed = {}; }
  getMove() {
    let mx = 0, my = 0;
    if (this.isDown('ArrowLeft')||this.isDown('KeyA')) mx -= 1;
    if (this.isDown('ArrowRight')||this.isDown('KeyD')) mx += 1;
    if (this.isDown('ArrowUp')||this.isDown('KeyW')) my -= 1;
    if (this.isDown('ArrowDown')||this.isDown('KeyS')) my += 1;
    return {x:mx, y:my};
  }
}

// ============================================================
// MOBILE CONTROLS
// ============================================================
class MobileControls {
  constructor() {
    this.joy = {active:false, x:0, y:0, ox:0, oy:0};
    this.moveDir = {x:0, y:0};
    this.btns = {meow:false, action:false, map:false, inventory:false, quests:false, pause:false};
    this.justTapped = {};
    this._setupJoystick();
    this._setupButtons();
    this._preventScroll();
  }
  _preventScroll() {
    document.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
    document.addEventListener('touchstart', e => {
      if (!e.target.closest('#screen-dialogue, #screen-inventory, #screen-quests, .screen-header, #quest-list, #inventory-grid, .settings-list, #achievements-grid, .about-content')) {
        e.preventDefault();
      }
    }, {passive:false});
  }
  _setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const base = document.getElementById('joystick-base');
    if (!zone || !knob) return;
    const maxR = 33;
    const onStart = (cx, cy) => {
      const r = zone.getBoundingClientRect();
      this.joy.active = true;
      this.joy.ox = r.left + r.width/2;
      this.joy.oy = r.top + r.height/2;
      this._updateJoy(cx, cy, maxR, knob);
    };
    const onMove = (cx, cy) => {
      if (!this.joy.active) return;
      this._updateJoy(cx, cy, maxR, knob);
    };
    const onEnd = () => {
      this.joy.active = false;
      this.moveDir = {x:0, y:0};
      knob.style.transform = 'translate(0,0)';
    };
    zone.addEventListener('touchstart', e => { const t=e.targetTouches[0]; onStart(t.clientX,t.clientY); }, {passive:false});
    zone.addEventListener('touchmove', e => { const t=e.targetTouches[0]; onMove(t.clientX,t.clientY); }, {passive:false});
    zone.addEventListener('touchend', onEnd, {passive:false});
    zone.addEventListener('touchcancel', onEnd, {passive:false});
    // Pointer fallback
    zone.addEventListener('pointerdown', e => onStart(e.clientX, e.clientY));
    window.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
    window.addEventListener('pointerup', onEnd);
  }
  _updateJoy(cx, cy, maxR, knob) {
    const dx = cx - this.joy.ox;
    const dy = cy - this.joy.oy;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const cd = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle)*cd;
    const ky = Math.sin(angle)*cd;
    knob.style.transform = `translate(${kx}px,${ky}px)`;
    this.moveDir = {
      x: dist > 8 ? Math.cos(angle) * Math.min(dist/maxR, 1) : 0,
      y: dist > 8 ? Math.sin(angle) * Math.min(dist/maxR, 1) : 0
    };
  }
  _setupButtons() {
    const btnMap = {
      'btn-meow':'meow','btn-action':'action',
      'btn-map':'map','btn-inventory':'inventory',
      'btn-quests':'quests','btn-pause':'pause',
    };
    Object.entries(btnMap).forEach(([id, action]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onDown = () => {
        this.btns[action] = true;
        this.justTapped[action] = true;
      };
      const onUp = () => { this.btns[action] = false; };
      el.addEventListener('touchstart', onDown, {passive:true});
      el.addEventListener('touchend', onUp, {passive:true});
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);
    });
  }
  wasPressed(action) {
    if (this.justTapped[action]) { delete this.justTapped[action]; return true; }
    return false;
  }
  clearJust() { this.justTapped = {}; }
  getMoveDir() { return this.moveDir; }
}

// ============================================================
// TIME SYSTEM
// ============================================================
class TimeSystem {
  constructor() {
    this.dayLength = 480; // seconds per game day
    this.gameTime = 6 * 3600; // start at 6:00 morning
    this.day = 1;
    this.elapsed = 0;
    this.season = 'summer';
    this.speedMultiplier = 1;
  }
  update(dt) {
    this.elapsed += dt * this.speedMultiplier;
    const secPerRealSec = 86400 / this.dayLength;
    this.gameTime += dt * secPerRealSec * this.speedMultiplier;
    if (this.gameTime >= 86400) {
      this.gameTime -= 86400;
      this.day++;
      this.justChangedDay = true;
    }
  }
  getTimeOfDay() {
    const h = this.gameTime / 3600;
    if (h >= 5 && h < 10) return 'morning';
    if (h >= 10 && h < 18) return 'day';
    if (h >= 18 && h < 22) return 'evening';
    return 'night';
  }
  getDisplayTime() {
    const h = Math.floor(this.gameTime / 3600);
    const m = Math.floor((this.gameTime % 3600) / 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }
  getSkyColor() {
    const t = this.getTimeOfDay();
    return {morning:'#87ceeb',day:'#5ba3d9',evening:'#ff7043',night:'#0a1520'}[t];
  }
  getSkyColors() {
    const t = this.getTimeOfDay();
    return {
      morning: {top:'#ff9966',mid:'#87ceeb',bottom:'#c8e6c9'},
      day:     {top:'#5ba3d9',mid:'#87ceeb',bottom:'#a5d6a7'},
      evening: {top:'#ff5722',mid:'#ff9800',bottom:'#f44336'},
      night:   {top:'#0a0a1e',mid:'#0a1520',bottom:'#1a2010'},
    }[t];
  }
  getTimeIcon() {
    return {morning:'🌅',day:'☀️',evening:'🌆',night:'🌙'}[this.getTimeOfDay()];
  }
}

// ============================================================
// WEATHER SYSTEM
// ============================================================
class WeatherSystem {
  constructor() {
    this.current = 'sunny';
    this.particles = [];
    this.changeTimer = 600;
    this.weathers = ['sunny','sunny','sunny','cloudy','cloudy','rain','wind','fog'];
    this._initParticles();
  }
  _initParticles() {
    this.particles = [];
    if (this.current === 'rain') {
      for (let i = 0; i < 150; i++) {
        this.particles.push({
          x: Math.random()*1920, y: Math.random()*1080,
          vx: -1, vy: 14 + Math.random()*6
        });
      }
    } else if (this.current === 'wind') {
      for (let i = 0; i < 30; i++) {
        this.particles.push({x:Math.random()*1920,y:Math.random()*1080,vx:6,vy:0.5});
      }
    }
  }
  update(dt, screenW, screenH) {
    this.changeTimer -= dt;
    if (this.changeTimer <= 0) {
      this.changeTimer = 400 + Math.random()*400;
      this.current = this.weathers[Math.floor(Math.random()*this.weathers.length)];
      this._initParticles();
    }
    const w = screenW || 1920;
    const h = screenH || 1080;
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.y > h) { p.y = -10; p.x = Math.random()*w; }
      if (p.x > w) { p.x = 0; }
    });
  }
  getAmbience() {
    return {sunny:'bright',cloudy:'soft',rain:'rain',wind:'windy',fog:'foggy'}[this.current];
  }
}

// ============================================================
// CAMERA
// ============================================================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.targetX = 0; this.targetY = 0;
    this.zoom = 1;
    this.shake = 0;
  }
  follow(tx, ty, screenW, screenH, worldW, worldH) {
    this.targetX = tx - screenW/2;
    this.targetY = ty - screenH/2;
    this.targetX = Math.max(0, Math.min(worldW - screenW, this.targetX));
    this.targetY = Math.max(0, Math.min(worldH - screenH, this.targetY));
    this.x += (this.targetX - this.x) * 0.1;
    this.y += (this.targetY - this.y) * 0.1;
  }
  applyShake() {
    if (this.shake > 0) {
      this.shake -= 0.5;
      return { sx: (Math.random()-0.5)*this.shake, sy: (Math.random()-0.5)*this.shake };
    }
    return {sx:0,sy:0};
  }
  toWorld(sx, sy) {
    return { x: sx + this.x, y: sy + this.y };
  }
  toScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}

// ============================================================
// PLAYER
// ============================================================
class Player {
  constructor(startX=700, startY=500) {
    this.x = startX; this.y = startY;
    this.speed = 120;
    this.dir = 1; // 1=right, -1=left
    this.frame = 0;
    this.isMoving = false;
    this.isSitting = false;
    this.isSleeping = false;
    this.sitTimer = 0;
    this.stats = {
      hunger: 80, energy: 90, mood: 85,
      curiosity: 70, cleanliness: 90,
      fame: 0,
    };
    this.stepTimer = 0;
    this.isMeowing = false;
    this.meowTimer = 0;
    this.speedMultiplier = 1;
    this.jumpCount = 0;
    this.gardenVisits = 0;
    this.purrCount = 0;
    this.meowCount = {};
  }
  update(dt, moveX, moveY, audio, onStep) {
    const spd = this.speed * (this.stats.energy < 20 ? 0.5 : 1) * dt;
    let moved = false;
    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX*moveX+moveY*moveY);
      this.x += (moveX/len) * spd;
      this.y += (moveY/len) * spd;
      if (moveX !== 0) this.dir = moveX > 0 ? 1 : -1;
      moved = true;
      this.isSitting = false;
      this.sitTimer = 0;
    }
    this.isMoving = moved;
    this.frame += dt * 60;
    // Sit down if idle
    if (!moved) {
      this.sitTimer += dt;
      if (this.sitTimer > 5) this.isSitting = true;
      if (this.sitTimer > 30) this.isSleeping = true;
    } else {
      this.isSleeping = false;
      this.sitTimer = 0;
    }
    // Step sound
    if (moved) {
      this.stepTimer += dt;
      if (this.stepTimer > 0.35) { this.stepTimer = 0; audio?.step(); }
    }
    // Hunger/Energy drain
    this.stats.hunger = Math.max(0, this.stats.hunger - dt * 0.3);
    this.stats.energy = Math.max(0, this.stats.energy - dt * 0.2);
    if (this.isSleeping) this.stats.energy = Math.min(100, this.stats.energy + dt * 2);
    if (this.stats.hunger < 20) this.stats.mood = Math.max(0, this.stats.mood - dt * 0.5);
    else this.stats.mood = Math.min(100, this.stats.mood + dt * 0.1);
    // Clamp
    Object.keys(this.stats).forEach(k => {
      this.stats[k] = Math.max(0, Math.min(100, this.stats[k]));
    });
  }
  move(mx, my, dt, canvasW, canvasH) {
    this.update(dt, mx, my, null, null);
    // Clamp to world bounds
    this.x = Math.max(20, Math.min(2780, this.x));
    this.y = Math.max(20, Math.min(1780, this.y));
  }
  feed(amount) {
    this.stats.hunger = Math.min(100, this.stats.hunger + amount);
    this.stats.mood = Math.min(100, this.stats.mood + 10);
  }
  meow(zone) {
    const key = zone || 'anywhere';
    this.meowCount[key] = (this.meowCount[key]||0) + 1;
    this.stats.mood = Math.min(100, this.stats.mood + 3);
  }
  purr() {
    this.purrCount++;
    this.stats.mood = Math.min(100, this.stats.mood + 5);
  }
}

// ============================================================
// INVENTORY SYSTEM
// ============================================================
class Inventory {
  constructor() {
    this.slots = {}; // itemId -> count
    this.maxSlots = 30;
  }
  add(itemId, count=1) {
    if (!ITEMS[itemId]) return false;
    this.slots[itemId] = (this.slots[itemId]||0) + count;
    return true;
  }
  remove(itemId, count=1) {
    if (!this.has(itemId, count)) return false;
    this.slots[itemId] -= count;
    if (this.slots[itemId] <= 0) delete this.slots[itemId];
    return true;
  }
  has(itemId, count=1) { return (this.slots[itemId]||0) >= count; }
  count(itemId) { return this.slots[itemId] || 0; }
  itemCount() { return Object.keys(this.slots).length; }
  getAll() {
    return Object.entries(this.slots).map(([id,cnt]) => ({id, ...(ITEMS[id]||{name:id,icon:'?',desc:''}), count:cnt}));
  }
}

// ============================================================
// QUEST SYSTEM
// ============================================================
class QuestSystem {
  constructor(inventory, audio, ui) {
    this.active = {};
    this.completed = new Set();
    this.inventory = inventory;
    this.audio = audio;
    this.ui = ui;
    this.progressCache = {};
  }
  start(questId) {
    if (this.active[questId] || this.completed.has(questId)) return false;
    const q = QUESTS[questId];
    if (!q) return false;
    this.active[questId] = {
      id: questId,
      stepIndex: 0,
      stepProgress: q.steps.map(() => 0),
    };
    this.ui?.notify(`📜 Новое задание: ${q.title}`);
    return true;
  }
  progress(type, target, count=1, ctx={}) {
    Object.values(this.active).forEach(aq => {
      const q = QUESTS[aq.id];
      if (!q) return;
      const step = q.steps[aq.stepIndex];
      if (!step) return;
      let match = false;
      if (step.target === target) match = true;
      else if (step.target === `give:${ctx.npc}:${target}`) match = true;
      else if (step.target === `talk:${target}`) match = true;
      else if (step.target === `meow:${target}`) match = true;
      else if (step.target === `explore:${target}`) match = true;
      else if (step.target === `unlock:${target}`) match = true;
      else if (step.target === 'friends' && type === 'friend') match = true;
      else if (step.target === `minigame:${target}`) match = true;
      else if (step.target === `firefly_spot` && target === 'firefly_spot') match = true;
      if (match) {
        aq.stepProgress[aq.stepIndex] = Math.min(step.count, aq.stepProgress[aq.stepIndex] + count);
        if (aq.stepProgress[aq.stepIndex] >= step.count) {
          aq.stepIndex++;
          if (aq.stepIndex >= q.steps.length) this._complete(aq.id);
          else this.ui?.notify(`✅ Шаг выполнен!`);
        }
      }
    });
  }
  _complete(qid) {
    const q = QUESTS[qid];
    delete this.active[qid];
    this.completed.add(qid);
    const r = q.reward || {};
    if (r.items) r.items.forEach(i => this.inventory.add(i));
    this.audio?.questComplete();
    this.ui?.notify(`🏆 Задание выполнено: ${q.title}!`);
    if (r.ending) window.game?._triggerEnding();
    // Trigger dependent quests
    Object.values(QUESTS).forEach(nq => {
      if (nq.trigger === `complete:${qid}`) {
        setTimeout(() => this.start(nq.id), 1000);
      }
    });
  }
  getStepProgress(questId) {
    const aq = this.active[questId];
    if (!aq) return 0;
    const q = QUESTS[questId];
    const step = q.steps[aq.stepIndex];
    return aq.stepProgress[aq.stepIndex] / step.count;
  }
  isActive(qid) { return !!this.active[qid]; }
  isComplete(qid) { return this.completed.has(qid); }
  checkTrigger(trigger) {
    Object.values(QUESTS).forEach(q => {
      if (q.trigger === trigger && !this.active[q.id] && !this.completed.has(q.id)) {
        this.start(q.id);
      }
    });
  }
  getActiveQuests() { return (Array.isArray(this.active) ? this.active : Object.values(this.active)).map(aq => ({...QUESTS[aq.id],...aq})); }
  getActiveQuestHint() {
    const active = this.getActiveQuests();
    if (!active.length) return '';
    const first = active[0];
    const q = QUESTS[first.id];
    if (!q) return '';
    const step = q.steps[first.stepIndex];
    return step ? step.desc : q.title;
  }
}

// ============================================================
// DIALOGUE SYSTEM
// ============================================================
class DialogueSystem {
  constructor(tg, audio, questSys) {
    this.tg = tg;
    this.audio = audio;
    this.questSys = questSys;
    this.active = false;
    this.queue = [];
    this.currentNPC = null;
    this.onClose = null;
    this._setupUI();
  }
  _setupUI() {
    const screen = document.getElementById('screen-dialogue');
    const content = document.getElementById('dialogue-content');
    screen?.addEventListener('click', () => this._advance());
    screen?.addEventListener('touchend', (e) => { e.preventDefault(); this._advance(); });
  }
  open(npcId, dialogs, onClose) {
    this.active = true;
    this.currentNPC = npcId;
    this.queue = [...dialogs];
    this.onClose = onClose;
    const npc = NPC_DATA[npcId];
    document.getElementById('dialogue-name').textContent = npc?.name || 'Рыжик';
    // Draw portrait
    const pc = document.getElementById('portrait-canvas');
    if (pc) {
      const pctx = pc.getContext('2d');
      pctx.clearRect(0,0,80,80);
      Draw.drawPortrait(pctx, npcId, 0, 0, 80, 80);
    }
    const screen = document.getElementById('screen-dialogue');
    screen?.classList.add('active');
    screen.style.display = 'flex';
    this._showNext();
    // Trigger quest check
    this.questSys?.progress('talk', npcId);
    this.questSys?.checkTrigger(`talk:${npcId}`);
  }
  _showNext() {
    if (!this.queue.length) { this.close(); return; }
    const line = this.queue.shift();
    const el = document.getElementById('dialogue-text');
    if (el) {
      el.textContent = '';
      let i = 0;
      const type = () => {
        if (i < line.length) {
          el.textContent += line[i++];
          setTimeout(type, 22);
        }
      };
      type();
    }
    // Show choices if object
    const choicesEl = document.getElementById('dialogue-choices');
    if (choicesEl) choicesEl.innerHTML = '';
    this.audio?.uiClick();
  }
  _advance() {
    if (!this.active) return;
    this._showNext();
  }
  close() {
    this.active = false;
    this._pendingLines = [];
    const screen = document.getElementById('screen-dialogue');
    if (screen) { screen.classList.remove('active'); screen.style.display = 'none'; }
    this.onClose?.();
  }
  // Compatibility methods used by Game
  queue(lines) {
    if (!lines || !lines.length) return;
    this._pendingLines = this._pendingLines || [];
    lines.forEach(l => this._pendingLines.push(l));
    if (!this.active) this._dequeueNext();
  }
  _dequeueNext() {
    if (!this._pendingLines || !this._pendingLines.length) { this.close(); return; }
    const line = this._pendingLines.shift();
    const npcId = line.speaker || 'ryzhik';
    const text = line.text || '';
    const name = line.name || NPC_DATA[npcId]?.name || (npcId === 'ryzhik' ? 'Рыжик' : npcId);
    this.active = true;
    this._currentText = text;
    this._typedText = '';
    this._typeIndex = 0;
    this._typeDone = false;
    // Update UI
    const nameEl = document.getElementById('dialogue-name');
    if (nameEl) nameEl.textContent = name;
    const textEl = document.getElementById('dialogue-text');
    if (textEl) textEl.textContent = '';
    const pc = document.getElementById('portrait-canvas');
    if (pc) {
      const pctx = pc.getContext('2d');
      pctx.clearRect(0,0,80,80);
      Draw.drawPortrait(pctx, npcId, 0, 0, 80, 80);
    }
    const screen = document.getElementById('screen-dialogue');
    if (screen) { screen.style.display = 'flex'; screen.classList.add('active'); }
    this._typingInterval = setInterval(() => {
      if (this._typeIndex < this._currentText.length) {
        this._typedText += this._currentText[this._typeIndex++];
        const el = document.getElementById('dialogue-text');
        if (el) el.textContent = this._typedText;
      } else {
        clearInterval(this._typingInterval);
        this._typeDone = true;
      }
    }, 25);
  }
  isActive() { return this.active; }
  advance() {
    if (!this.active) return;
    if (!this._typeDone) {
      // Skip typing
      clearInterval(this._typingInterval);
      this._typeDone = true;
      const el = document.getElementById('dialogue-text');
      if (el) el.textContent = this._currentText || '';
      return;
    }
    this._dequeueNext();
  }
  update(dt) { /* typing handled by setInterval */ }
  render(ctx, w, h) { /* dialogue rendered via DOM */ }
}

// ============================================================
// ACHIEVEMENT SYSTEM
// ============================================================
class AchievementSystem {
  constructor(ui) {
    this.ui = ui;
    this.unlocked = new Set();
  }
  unlock(id) {
    if (this.unlocked.has(id)) return;
    const a = ACHIEVEMENTS[id];
    if (!a) return;
    this.unlocked.add(id);
    this.ui?.notify(`🏆 Достижение: ${a.name}!`);
  }
  check(idOrStats, game) {
    // Called as check('achievement_id', game) from specific events
    if (typeof idOrStats === 'string') {
      const id = idOrStats;
      if (id === 'first_meow') this.unlock('first_meow');
      else if (id === 'first_friend') this.unlock('first_friend');
      else if (id === 'collector') {
        if (game?.inventory?.itemCount() >= 1) this.unlock('first_item');
        if (game?.inventory?.itemCount() >= 5) this.unlock('collector');
      }
      else if (id === 'explorer') {
        if (game?.openedZones?.length >= 5) this.unlock('explorer');
      }
      else this.unlock(id);
      return;
    }
    // Old-style full check
    const inv = game?.inventory;
    const q = game?.quests;
    if (inv?.count('pebble') >= 5) this.unlock('collector');
    if (inv?.itemCount() >= 10) this.unlock('full_inventory');
    if (q?.completed?.size >= 10) this.unlock('yard_hero');
    if (q?.completed?.size >= Object.keys(QUESTS).length) this.unlock('all_quests');
    if (game?.openedZones?.length >= Object.keys(ZONES).length) this.unlock('all_zones');
  }
}


// ============================================================
// UI MANAGER
// ============================================================
class UIManager {
  constructor(tg) {
    this.tg = tg;
    this.notifications = [];
    this._setupButtons();
  }
  notify(msg, duration=3000) {
    const area = document.getElementById('notification-area');
    if (!area) return;
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = msg;
    area.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }
  toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }
  updateStats(stats) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.style.width = Math.max(0,Math.min(100,val)) + '%';
    };
    set('fill-hunger', stats.hunger);
    set('fill-energy', stats.energy);
    set('fill-mood', stats.mood);
  }
  updateTime(ts) {
    const ti = document.getElementById('time-icon');
    const tt = document.getElementById('time-text');
    const dt = document.getElementById('day-text');
    if (ti) ti.textContent = ts.getTimeIcon();
    if (tt) tt.textContent = {morning:'Утро',day:'День',evening:'Вечер',night:'Ночь'}[ts.getTimeOfDay()];
    if (dt) dt.textContent = `День ${ts.day}`;
  }
  updateQuestHint(text) {
    const el = document.getElementById('quest-hint');
    if (el) { el.textContent = text; el.style.display = text ? 'block' : 'none'; }
  }
  updateActionHint(text) {
    const el = document.getElementById('action-hint');
    if (el) el.textContent = text || 'Действие';
  }
  renderInventory(inv) {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    this._selectedItemId = null;
    const items = inv.getAll();
    items.forEach(item => {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.innerHTML = `<span class="item-icon">${item.icon||'📦'}</span><span class="item-name">${item.name||item.id}</span>${item.count>1?`<span class="item-count">×${item.count}</span>`:''}`;
      const selectItem = () => {
        document.querySelectorAll('.inv-slot').forEach(s=>s.classList.remove('selected'));
        slot.classList.add('selected');
        this._selectedItemId = item.id;
        // Show use panel
        const pan = document.getElementById('item-use-panel');
        const nameEl = document.getElementById('item-use-name');
        const descEl = document.getElementById('item-use-desc');
        if (pan) pan.classList.add('show');
        if (nameEl) nameEl.textContent = `${item.icon||'📦'} ${item.name||item.id}`;
        if (descEl) descEl.textContent = item.desc || 'Предмет для квеста или использования.';
        // Also update detail area
        const det = document.getElementById('item-detail');
        if (det) det.innerHTML = `<strong>${item.icon||'📦'} ${item.name||item.id}</strong><br><span style="color:rgba(255,255,255,0.6)">${item.desc||''}</span>`;
      };
      let touched = false;
      slot.addEventListener('touchend', (e) => {
        e.preventDefault();
        touched = true;
        selectItem();
        setTimeout(() => { touched = false; }, 400);
      }, { passive: false });
      slot.addEventListener('click', () => { if (!touched) selectItem(); });
      grid.appendChild(slot);
    });
    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.4);padding:40px 20px;font-size:14px">🐾 Инвентарь пуст.<br>Исследуй двор — ищи предметы!</div>';
    }
    this._hideItemPanel();
  }
  _hideItemPanel() {
    const pan = document.getElementById('item-use-panel');
    if (pan) pan.classList.remove('show');
    this._selectedItemId = null;
    document.querySelectorAll('.inv-slot').forEach(s=>s.classList.remove('selected'));
  }
  _useSelectedItem(game) {
    const id = this._selectedItemId;
    if (!id || !game) return;
    const item = ITEMS[id];
    if (!item) return;
    // Apply item effects
    let used = false;
    if (item.use === 'food') {
      game.player.stats.hunger = Math.min(100, game.player.stats.hunger + (item.hunger||30));
      game.player.stats.mood   = Math.min(100, game.player.stats.mood + 5);
      this.notify(`🍽 ${item.name} съеден! Сытость +${item.hunger||30}`);
      game.inventory.remove(id);
      used = true;
    } else if (item.use === 'energy') {
      game.player.stats.energy = Math.min(100, game.player.stats.energy + (item.energy||20));
      this.notify(`⚡ ${item.name} — энергия восстановлена!`);
      game.inventory.remove(id);
      used = true;
    } else if (item.use === 'mood') {
      game.player.stats.mood = Math.min(100, game.player.stats.mood + (item.mood||15));
      this.notify(`😺 ${item.name} — настроение улучшилось!`);
      game.inventory.remove(id);
      used = true;
    } else if (item.use === 'quest') {
      // Try to progress quests
      Object.values(game.quests.active).forEach(aq => {
        const qd = QUESTS[aq.id];
        if (!qd) return;
        const step = qd.steps[aq.stepIndex];
        if (step && (step.target === id || step.target === `give:${id}`)) {
          game.quests.progress('collect', id, 1, {});
          this.notify(`✅ Предмет использован для задания!`);
          game.inventory.remove(id);
          used = true;
        }
      });
      if (!used) this.notify(`📌 ${item.name} — нужен для задания.`);
    } else {
      // Try quest progress anyway
      let questUsed = false;
      Object.values(game.quests.active).forEach(aq => {
        if (questUsed) return;
        const qd = QUESTS[aq.id];
        if (!qd) return;
        const step = qd.steps[aq.stepIndex];
        if (step && step.target === id) {
          game.quests.progress('collect', id, 1, {});
          this.notify(`✅ ${item.name} — использован!`);
          game.inventory.remove(id);
          questUsed = true;
        }
      });
      if (!questUsed) this.notify(`📌 ${item.name} — это предмет для задания, береги его!`);
    }
    if (used) {
      this._hideItemPanel();
      this.renderInventory(game.inventory);
      if (game.audio) game.audio.pickup();
      if (game.telegram) game.telegram.haptic('medium');
    }
  }
  renderQuests(questSys) {
    const list = document.getElementById('quest-list');
    if (!list) return;
    list.innerHTML = '';
    const tab = document.querySelector('.quest-tab.active')?.dataset.tab;
    const quests = tab === 'completed'
      ? [...questSys.completed].map(id=>QUESTS[id]).filter(Boolean)
      : questSys.getActiveQuests().map(aq=>({...QUESTS[aq.id],...aq}));
    quests.forEach(q => {
      const el = document.createElement('div');
      el.className = 'quest-item' + (questSys.completed.includes && questSys.completed.includes(q.id) ? ' completed' : '');
      const prog = questSys.getStepProgress(q.id);
      const curStep = QUESTS[q.id]?.steps[q.stepIndex];
      el.innerHTML = `
        <div class="quest-title">${q.title}</div>
        <div class="quest-desc">${curStep?.desc || q.desc}</div>
        ${prog > 0 ? `<div class="quest-progress"><div class="quest-progress-fill" style="width:${prog*100}%"></div></div>` : ''}
      `;
      list.appendChild(el);
    });
    if (!quests.length) {
      list.innerHTML = '<div style="text-align:center;color:#888;padding:20px">' + (tab==='completed'?'Нет выполненных заданий':'Нет активных заданий') + '</div>';
    }
  }
  renderAchievements(achSys) {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.values(ACHIEVEMENTS).forEach(a => {
      const unlocked = achSys.unlocked.has(a.id);
      const el = document.createElement('div');
      el.className = 'achievement-item' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `
        <div class="ach-icon" style="opacity:${unlocked?1:0.3}">${a.icon}</div>
        <div class="ach-name">${unlocked?a.name:'???'}</div>
        <div class="ach-desc">${unlocked?a.desc:'Не разблокировано'}</div>
      `;
      grid.appendChild(el);
    });
  }
  renderMap(allZones, openedZones, playerX, playerY, npcs) {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const cw = canvas.parentElement?.clientWidth || 360;
    const ch = canvas.parentElement?.clientHeight - 80 || 400;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a1a05';
    ctx.fillRect(0,0,cw,ch);
    const scaleX = cw / 2800;
    const scaleY = ch / 1800;
    // Draw zones
    Object.values(allZones).forEach(z => { z = {...z, unlocked: openedZones.includes(z.id) || z.unlocked};
      const mx = z.x * scaleX, my = z.y * scaleY;
      ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI*2);
      ctx.fillStyle = z.unlocked ? z.color : '#333';
      ctx.fill();
      ctx.strokeStyle = z.unlocked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.5; ctx.stroke();
      if (z.unlocked) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(z.name, mx, my+22);
      }
    });
    // Player
    const px = playerX * scaleX, py = playerY * scaleY;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2);
    ctx.fillStyle = '#e8763a'; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
    // Pulse
    ctx.beginPath(); ctx.arc(px, py, 10 + Math.sin(Date.now()*0.005)*3, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(232,118,58,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  }
  renderMinimap(allZones, openedZones, playerX, playerY, camX, camY, canvasW, canvasH) {
    const mm = document.getElementById('minimap');
    if (!mm) return;
    const ctx = mm.getContext('2d');
    ctx.clearRect(0,0,80,80);
    ctx.fillStyle = 'rgba(10,25,5,0.8)';
    ctx.fillRect(0,0,80,80);
    const s = 80/2800, sy = 80/1800;
    Object.values(allZones).filter(z=>openedZones.includes(z.id)||z.unlocked).forEach(z => {
      ctx.beginPath(); ctx.arc(z.x*s,z.y*sy,4,0,Math.PI*2);
      ctx.fillStyle=z.color; ctx.fill();
    });
    // Player dot
    ctx.beginPath(); ctx.arc(playerX*s, playerY*sy, 3, 0, Math.PI*2);
    ctx.fillStyle = '#e8763a'; ctx.fill();
    // Viewport box
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(camX*s, camY*sy, canvasW*s, canvasH*sy);
  }
  openScreen(name) {
    this.activeScreen = name;
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id !== 'screen-main-menu' && s.id !== 'screen-dialogue') {
        s.style.display = 'none';
        s.classList.remove('active');
      }
    });
    const scr = document.getElementById(`screen-${name}`);
    if (scr) { scr.style.display = 'flex'; scr.classList.add('active'); }
    const mui = document.getElementById('mobile-ui');
    const hud = document.getElementById('hud');
    if (mui) mui.style.display = 'none';
    if (hud) hud.style.display = 'none';
  }
  closeScreen(name) {
    if (name && this.activeScreen !== name && name !== this.activeScreen) {
      // Allow closing any
    }
    this.activeScreen = null;
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id !== 'screen-main-menu') {
        s.style.display = 'none'; s.classList.remove('active');
      }
    });
    const mui = document.getElementById('mobile-ui');
    const hud = document.getElementById('hud');
    if (mui) mui.style.display = 'block';
    if (hud) hud.style.display = 'block';
  }
  _setupButtons() {
    // Close buttons
    document.querySelectorAll('.close-btn[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeScreen());
    });
    // Quest tabs
    document.querySelectorAll('.quest-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.quest-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  }
}

// ============================================================
// WORLD RENDERER
// ============================================================
class World {
  constructor() {
    this.width = 2800;
    this.height = 1800;
    this.trees = this._genTrees();
    this.flowers = this._genFlowers();
    this.clouds = this._genClouds();
    this.fireflies = this._genFireflies();
  }
  _genTrees() {
    return [
      {x:1400,y:480,r:35,h:65,type:'apple'},{x:1500,y:510,r:32,h:60,type:'apple'},
      {x:1600,y:460,r:38,h:70,type:'apple'},{x:1450,y:550,r:30,h:55,type:'apple'},
      {x:300,y:350,r:28,h:55,type:'oak'},{x:200,y:420,r:32,h:60,type:'oak'},
      {x:2100,y:350,r:36,h:68,type:'pine'},{x:2250,y:300,r:30,h:58,type:'pine'},
      {x:2300,y:450,r:34,h:65,type:'pine'},{x:2150,y:500,r:28,h:52,type:'pine'},
      {x:1750,y:800,r:25,h:50,type:'oak'},{x:1950,y:750,r:30,h:58,type:'oak'},
      {x:2400,y:650,r:35,h:68,type:'pine'},{x:2500,y:580,r:32,h:62,type:'pine'},
      {x:150,y:1300,r:28,h:55,type:'oak'},{x:250,y:1250,r:30,h:58,type:'oak'},
    ];
  }
  _genFlowers() {
    const f = [];
    const colors = ['#e91e63','#ff9800','#9c27b0','#f44336','#ffeb3b','#2196f3','#4caf50'];
    for (let i = 0; i < 80; i++) {
      f.push({
        x: 100 + Math.random()*2600,
        y: 300 + Math.random()*1400,
        color: colors[Math.floor(Math.random()*colors.length)]
      });
    }
    return f;
  }
  _genClouds() {
    return Array.from({length:12},(_,i)=>({
      x: Math.random()*2800, y: 30+Math.random()*200,
      r: 25+Math.random()*35, opacity:0.5+Math.random()*0.4, speed:5+Math.random()*10
    }));
  }
  _genFireflies() {
    const ff = [];
    for (let i=0;i<50;i++){
      ff.push({
        x: 1600+Math.random()*400, y: 800+Math.random()*300,
        vx:(Math.random()-0.5)*15, vy:(Math.random()-0.5)*10,
        phase: Math.random()*Math.PI*2
      });
    }
    return ff;
  }
  updateClouds(dt) {
    this.clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > this.width + 100) c.x = -100;
    });
  }
  updateFireflies(dt) {
    this.fireflies.forEach(f => {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 1500 || f.x > 2100) f.vx *= -1;
      if (f.y < 700 || f.y > 1200) f.vy *= -1;
    });
  }
  render(ctx, cam, timeSystem, weatherSystem, zones, worldItems, npcs, player, frame) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const skyColors = timeSystem.getSkyColors();
    // Sky background
    const skyGrad = ctx.createLinearGradient(0,0,0,ch*0.4);
    skyGrad.addColorStop(0, skyColors.top);
    skyGrad.addColorStop(0.6, skyColors.mid);
    skyGrad.addColorStop(1, skyColors.bottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,cw,ch*0.4);

    ctx.save();
    const {sx, sy} = cam.applyShake();
    ctx.translate(-cam.x + sx, -cam.y + sy);

    // Sun or moon (parallax)
    const tod = timeSystem.getTimeOfDay();
    if (tod === 'day' || tod === 'morning') {
      Draw.drawSun(ctx, cam.x + 120, cam.y + 80, frame);
    }

    // Clouds (parallax)
    ctx.save(); ctx.translate(cam.x * 0.3, 0);
    Draw.drawClouds(ctx, this.clouds, frame);
    ctx.restore();

    // Ground
    Draw.drawGrass(ctx, 0, ch*0.35 + cam.y, this.width, this.height - ch*0.35, 42);

    // Zones visual
    this._drawZoneVisuals(ctx, zones, timeSystem);

    // Objects
    this._drawWorldObjects(ctx, zones, timeSystem, frame);

    // Flowers (behind everything)
    Draw.drawFlowers(ctx, this.flowers, frame);

    // Trees
    Draw.drawTrees(ctx, this.trees);

    // World items
    worldItems.filter(i=>!i.collected).forEach(wi => {
      const _wid = wi.itemId || wi.item;
      const item = ITEMS[_wid];
      if (!item) return;
      const pulse = 1 + Math.sin(frame*0.1 + wi.x)*0.08;
      ctx.save();
      ctx.translate(wi.x, wi.y);
      ctx.scale(pulse, pulse);
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255,220,100,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(item.icon, 0, 0);
      ctx.shadowBlur = 0;
      // Shadow under item
      ctx.beginPath(); ctx.ellipse(0,12,8,2.5,0,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fill();
      ctx.restore();
    });

    // NPCs (sorted by y for depth)
    const allNPCs = [...npcs].sort((a,b)=>(a.currentY||a.y)-(b.currentY||b.y));
    allNPCs.forEach(npc => {
      const data = NPC_DATA[npc.id];
      if (!data) return;
      const sched = data.schedule?.[tod];
      if (sched === 'none' || (sched === 'inside' && tod === 'night')) return;
      // Use currentX/currentY for position, merge into draw object
      const drawNpc = { ...npc, x: npc.currentX || npc.x, y: npc.currentY || npc.y };
      if (data.isAnimal) Draw.drawAnimalNPC(ctx, drawNpc, frame);
      else Draw.drawHumanNPC(ctx, drawNpc, frame);
    });

    // Player (sorted relative to NPCs)
    Draw.drawCat(ctx, player.x, player.y, player.dir, player.frame, player.isMoving, player.isSitting, player.isSleeping);

    // Fireflies (night/evening only)
    if (tod === 'night' || tod === 'evening') {
      Draw.drawFireflies(ctx, this.fireflies, frame);
    }

    // Window lights
    Draw.drawWindowLights(ctx, 700, 200, tod);

    // Weather
    Draw.drawWeatherEffects(ctx, weatherSystem.current, weatherSystem.particles, this.width, this.height);

    ctx.restore();

    // Lighting overlay (screen space)
    Draw.drawLightingOverlay(ctx, tod, cw, ch, 0, 0);
  }

  _drawZoneVisuals(ctx, zones, ts) {
    // Pond
    Draw.drawPond(ctx, 1850, 950, 200, 130, Date.now());
    // Greenhouse
    const ghUnlocked = zones.greenhouse?.unlocked;
    Draw.drawGreenhouse(ctx, 2200, 1000, ghUnlocked);
    // Barn
    Draw.drawBarn(ctx, 1300, 1100);
    // House
    Draw.drawHouse(ctx, 700, 150);
    // Fence
    Draw.drawFence(ctx, [[0,450,180,80],[0,550,180,80]]);
    // Well
    this._drawWell(ctx, 380, 680);
    // Campfire
    Draw.drawCampfire(ctx, 850, 780, Date.now());
    // Cat corner
    this._drawCatCorner(ctx, 780, 430);
    // Garden path
    this._drawPath(ctx);
  }

  _drawWorldObjects(ctx, zones, ts, frame) {
    // Grass patches
    const tod = ts.getTimeOfDay();
    // Hay/decoration around barn
    ctx.save();
    ctx.translate(1250, 1200);
    for (let h=0;h<3;h++) {
      ctx.beginPath(); ctx.ellipse(h*25-20,0,15,10,0,0,Math.PI*2);
      ctx.fillStyle='#c8a84b'; ctx.fill();
    }
    ctx.restore();
    // Pond reeds
    for(let r=0;r<5;r++){
      const rx=1720+r*30, ry=1020;
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx+5,ry-40+Math.sin(frame*0.05+r)*5);
      ctx.strokeStyle='#558b2f'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(rx+5,ry-42+Math.sin(frame*0.05+r)*5,4,8,0,0,Math.PI*2);
      ctx.fillStyle='#795548'; ctx.fill();
    }
    // Mailbox
    ctx.save();
    ctx.translate(120, 380);
    ctx.beginPath(); ctx.roundRect(-8,-15,16,20,[3]);
    ctx.fillStyle='#e53935'; ctx.fill();
    ctx.strokeStyle='#b71c1c'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.rect(-1,0,2,18);
    ctx.fillStyle='#795548'; ctx.fill();
    ctx.restore();
  }

  _drawWell(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    // Base
    ctx.beginPath(); ctx.ellipse(0,0,28,16,0,0,Math.PI*2);
    ctx.fillStyle='#78909c'; ctx.fill();
    ctx.strokeStyle='#546e7a'; ctx.lineWidth=2; ctx.stroke();
    // Walls
    ctx.beginPath(); ctx.rect(-28,-25,56,25);
    ctx.fillStyle='#90a4ae'; ctx.fill();
    ctx.strokeStyle='#546e7a'; ctx.lineWidth=1.5; ctx.stroke();
    // Top beam
    ctx.beginPath(); ctx.rect(-30,-30,60,6);
    ctx.fillStyle='#795548'; ctx.fill();
    // Posts
    [-28,28].forEach(px => {
      ctx.beginPath(); ctx.rect(px-4,-50,8,25);
      ctx.fillStyle='#795548'; ctx.fill();
    });
    // Bucket
    ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(0,-45);
    ctx.strokeStyle='#333'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-6,-55,12,12,[2]);
    ctx.fillStyle='#78909c'; ctx.fill();
    ctx.restore();
  }

  _drawCatCorner(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    // Base platform
    ctx.beginPath(); ctx.roundRect(-30,0,60,15,[3]);
    ctx.fillStyle='#8B4513'; ctx.fill();
    ctx.strokeStyle='#5D2E0C'; ctx.lineWidth=1; ctx.stroke();
    // Cushion
    ctx.beginPath(); ctx.roundRect(-25,-8,50,12,[6]);
    ctx.fillStyle='#e91e63'; ctx.fill();
    ctx.strokeStyle='#c2185b'; ctx.lineWidth=0.5; ctx.stroke();
    // Pillow center
    ctx.beginPath(); ctx.ellipse(0,-2,15,5,0,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fill();
    // Bowl
    ctx.beginPath(); ctx.ellipse(35,-5,10,6,0,0,Math.PI*2);
    ctx.fillStyle='#78909c'; ctx.fill();
    ctx.strokeStyle='#546e7a'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(35,-7,8,3,0,0,Math.PI*2);
    ctx.fillStyle='rgba(100,160,255,0.5)'; ctx.fill();
    // Small sign
    ctx.beginPath(); ctx.roundRect(-8,-22,16,10,[2]);
    ctx.fillStyle='#f5f5dc'; ctx.fill();
    ctx.fillStyle='#5D2E0C'; ctx.font='bold 6px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Рыжик',0,-14);
    ctx.restore();
  }

  _drawPath(ctx) {
    ctx.strokeStyle = 'rgba(200,180,140,0.3)';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(700, 400);
    ctx.lineTo(700, 600);
    ctx.lineTo(1000, 700);
    ctx.lineTo(1400, 600);
    ctx.lineTo(1800, 900);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(700, 600);
    ctx.lineTo(400, 700);
    ctx.lineTo(200, 600);
    ctx.stroke();
  }
}


// ============================================================
// MINI GAME SYSTEM
// ============================================================
class MiniGameSystem {
  constructor(audio, questSys, ui) {
    this.audio = audio;
    this.questSys = questSys;
    this.ui = ui;
    this.active = null;
    this.canvas = document.getElementById('minigame-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.score = 0;
    this.time = 0;
    this.gameObjects = [];
    this.player = {x:0,y:0};
    this._rafId = null;
    document.getElementById('btn-minigame-close')?.addEventListener('click',()=>this.close());
  }
  start(type) {
    this.active = type;
    this.score = 0;
    this.time = 0;
    this.gameObjects = [];
    document.getElementById('screen-minigame').style.display='flex';
    document.getElementById('screen-minigame').classList.add('active');
    document.getElementById('mobile-ui').style.display='none';
    document.getElementById('hud').style.display='none';
    if (type === 'fishing') this._setupFishing();
    else if (type === 'butterfly') this._setupButterfly();
    this._loop(performance.now());
  }
  _loop(now) {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - (this._lastT||now)) / 1000);
    this._lastT = now;
    this._update(dt);
    this._draw();
    document.getElementById('minigame-score').textContent = `Очки: ${this.score}`;
    this._rafId = requestAnimationFrame(t=>this._loop(t));
  }
  _setupFishing() {
    const w = this.canvas.width = window.innerWidth;
    const h = this.canvas.height = window.innerHeight;
    this.player = {x:w/2, y:h*0.4, line:h*0.4, casting:false, catchZone:{x:w/2,y:h*0.7,r:30}};
    this.gameObjects = [];
    for (let f=0;f<8;f++) {
      this.gameObjects.push({
        type:'fish', x:100+Math.random()*(w-200), y:h*0.6+Math.random()*h*0.25,
        vx:(Math.random()-0.5)*80, vy:0, caught:false, size:10+Math.random()*15
      });
    }
    this.time = 30;
    // Touch to cast
    this.canvas.ontouchend = (e) => {
      const t = e.changedTouches[0];
      const r = this.canvas.getBoundingClientRect();
      this.player.castX = t.clientX - r.left;
      this.player.casting = true;
      setTimeout(()=>{ this.player.casting=false; this._checkFishCatch(); }, 800);
    };
    this.canvas.onclick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.player.castX = e.clientX - r.left;
      this.player.casting = true;
      setTimeout(()=>{ this.player.casting=false; this._checkFishCatch(); }, 800);
    };
  }
  _checkFishCatch() {
    const cx = this.player.castX || this.player.x;
    const cy = this.player.y + 200;
    let caught = null;
    this.gameObjects.forEach(obj => {
      if (obj.type==='fish' && !obj.caught) {
        const d = Math.sqrt((obj.x-cx)**2+(obj.y-cy)**2);
        if (d < 50) { obj.caught=true; caught=obj; }
      }
    });
    if (caught) {
      this.score += 10;
      this.audio?.pickup();
      this.questSys?.progress('collect','fish',1);
      this.questSys?.progress('minigame','fishing',1);
    }
  }
  _setupButterfly() {
    const w = this.canvas.width = window.innerWidth;
    const h = this.canvas.height = window.innerHeight;
    this.player = {x:w/2, y:h/2, r:20};
    this.gameObjects = [];
    for (let b=0;b<6;b++){
      this.gameObjects.push({
        type:'butterfly', x:100+Math.random()*(w-200), y:100+Math.random()*(h-200),
        vx:(Math.random()-0.5)*120, vy:(Math.random()-0.5)*100,
        phase:Math.random()*Math.PI*2, caught:false,
        color:['#ff9800','#9c27b0','#4caf50','#e91e63','#2196f3'][Math.floor(Math.random()*5)]
      });
    }
    this.time = 20;
    const move = (cx,cy) => {
      const r = this.canvas.getBoundingClientRect();
      this.player.x = cx - r.left;
      this.player.y = cy - r.top;
    };
    this.canvas.ontouchmove = (e) => { e.preventDefault(); const t=e.touches[0]; move(t.clientX,t.clientY); };
    this.canvas.onmousemove = (e) => move(e.clientX, e.clientY);
  }
  _update(dt) {
    this.time -= dt;
    if (this.time <= 0) { this.close(true); return; }
    const w = this.canvas.width, h = this.canvas.height;
    if (this.active === 'fishing') {
      this.gameObjects.forEach(obj => {
        if (!obj.caught) {
          obj.x += obj.vx * dt;
          obj.y += Math.sin(Date.now()*0.002+obj.x)*0.5;
          if (obj.x<50||obj.x>w-50) obj.vx*=-1;
        }
      });
    } else if (this.active === 'butterfly') {
      this.gameObjects.forEach(obj => {
        if (!obj.caught) {
          obj.x += obj.vx * dt;
          obj.y += obj.vy * dt;
          obj.phase += dt * 3;
          if (obj.x<50||obj.x>w-50) obj.vx*=-1;
          if (obj.y<50||obj.y>h-50) obj.vy*=-1;
          // Check catch
          const d = Math.sqrt((obj.x-this.player.x)**2+(obj.y-this.player.y)**2);
          if (d < this.player.r + 20) {
            obj.caught = true; this.score += 15;
            this.audio?.pickup();
          }
        }
      });
    }
  }
  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    if (this.active === 'fishing') {
      // Water background
      const wg = ctx.createLinearGradient(0,h*0.5,0,h);
      wg.addColorStop(0,'#1565c0'); wg.addColorStop(1,'#0d47a1');
      ctx.fillStyle='#1a3510'; ctx.fillRect(0,0,w,h*0.5);
      ctx.fillStyle=wg; ctx.fillRect(0,h*0.5,w,h*0.5);
      // Water surface line
      ctx.strokeStyle='rgba(100,180,255,0.5)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,h*0.5); ctx.lineTo(w,h*0.5); ctx.stroke();
      // Ripples
      for(let r=0;r<5;r++){
        ctx.beginPath(); ctx.ellipse(50+r*w/5,h*0.5,20+r*10,5,0,0,Math.PI*2);
        ctx.strokeStyle='rgba(100,180,255,0.2)'; ctx.lineWidth=1; ctx.stroke();
      }
      // Fisherman (simple)
      ctx.beginPath(); ctx.arc(w/2,h*0.35,20,0,Math.PI*2);
      ctx.fillStyle='#e8763a'; ctx.fill();
      // Rod
      ctx.beginPath(); ctx.moveTo(w/2+10,h*0.35-10);
      const lineEnd = this.player.casting ? {x:this.player.castX||w/2, y:h*0.65} : {x:w/2,y:h*0.45};
      ctx.lineTo(w/2+40,h*0.2); ctx.lineTo(lineEnd.x,lineEnd.y);
      ctx.strokeStyle='#795548'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke();
      // Hook
      ctx.beginPath(); ctx.arc(lineEnd.x,lineEnd.y,5,0,Math.PI*2);
      ctx.fillStyle='#aaa'; ctx.fill();
      // Catch zone indicator
      if (this.player.casting) {
        ctx.beginPath(); ctx.arc(this.player.castX||w/2, h*0.65, 40, 0, Math.PI*2);
        ctx.strokeStyle='rgba(255,255,100,0.4)'; ctx.lineWidth=2; ctx.stroke();
      }
      // Fish
      this.gameObjects.forEach(obj => {
        if (obj.caught) return;
        ctx.save(); ctx.translate(obj.x,obj.y);
        ctx.scale(obj.vx>0?1:-1,1);
        ctx.font=`${obj.size*2}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🐟',0,0);
        ctx.restore();
      });
      // UI
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(w/2-80,20,160,40,[20]); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
      ctx.fillText(`⏱ ${Math.ceil(this.time)}с  🐟 ${this.score}`, w/2, 45);
      ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='13px sans-serif';
      ctx.fillText('Нажмите на воду, чтобы забросить удочку', w/2, h-20);

    } else if (this.active === 'butterfly') {
      ctx.fillStyle='#2d5a1b'; ctx.fillRect(0,0,w,h);
      // Flowers
      for(let i=0;i<8;i++){
        ctx.font='24px sans-serif'; ctx.textAlign='center';
        ctx.fillText('🌸',50+i*w/8,h-40);
      }
      // Net cursor
      ctx.beginPath(); ctx.arc(this.player.x,this.player.y,this.player.r,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.player.x,this.player.y-5); ctx.lineTo(this.player.x,this.player.y+60);
      ctx.strokeStyle='#795548'; ctx.lineWidth=3; ctx.stroke();
      // Butterflies
      this.gameObjects.forEach(obj => {
        if (obj.caught) return;
        ctx.save(); ctx.translate(obj.x,obj.y);
        const ws = Math.sin(obj.phase)*0.8;
        // Wings
        ctx.save(); ctx.scale(ws,1);
        ctx.beginPath(); ctx.ellipse(-10,0,15,10,0.3,0,Math.PI*2);
        ctx.beginPath(); ctx.ellipse(-10,0,15,10,0.3,0,Math.PI*2);
        ctx.fillStyle=obj.color+'99'; ctx.fill();
        ctx.restore();
        ctx.save(); ctx.scale(-ws,1);
        ctx.beginPath(); ctx.ellipse(-10,0,15,10,0.3,0,Math.PI*2);
        ctx.fillStyle=obj.color+'99'; ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(0,12);
        ctx.strokeStyle='#333'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.restore();
      });
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(w/2-80,20,160,40,[20]); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
      ctx.fillText(`⏱ ${Math.ceil(this.time)}с  🦋 ${this.score}`, w/2, 45);
      ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='13px sans-serif';
      ctx.fillText('Двигайте пальцем, чтобы поймать бабочек', w/2, h-20);
    }
  }
  close(completed=false) {
    this.active = null;
    cancelAnimationFrame(this._rafId);
    document.getElementById('screen-minigame').style.display='none';
    document.getElementById('screen-minigame').classList.remove('active');
    document.getElementById('mobile-ui').style.display='block';
    document.getElementById('hud').style.display='block';
    if (completed) this.ui?.notify(`🎮 Мини-игра! Очки: ${this.score}`);
  }
}


// ============================================================
// MAIN GAME CLASS
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this.paused = false;
    this.gameStarted = false;
    this.lastTime = 0;
    this.fps = 0;
    this._fpsCounter = 0;
    this._fpsTimer = 0;
    this.targetFPS = 60;
    this._rafId = null;

    // Systems
    this.telegram = new TelegramBridge();
    this.audio = new AudioSystem();
    this.save = new SaveSystem();
    this.input = new Input();
    this.time = new TimeSystem();
    this.weather = new WeatherSystem();
    this.camera = new Camera(2800, 1800);
    this.player = new Player(700, 500);
    this.inventory = new Inventory();
    this.quests = new QuestSystem();
    this.dialogue = new DialogueSystem();
    this.achievements = new AchievementSystem();
    this.ui = new UIManager();
    this.world = new World();
    this.minigame = new MiniGameSystem();

    // Cross-references
    this.quests.ui = this.ui;
    this.quests.inventory = this.inventory;
    this.quests.achievements = this.achievements;
    this.quests.audio = this.audio;
    this.quests.telegram = this.telegram;
    this.dialogue.ui = this.ui;
    this.dialogue.quests = this.quests;
    this.achievements.ui = this.ui;
    this.achievements.telegram = this.telegram;
    this.achievements.audio = this.audio;
    this.ui.audio = this.audio;
    this.ui.telegram = this.telegram;
    this.minigame.ui = this.ui;
    this.minigame.audio = this.audio;

    this.mobile = new MobileControls();

    // NPC state
    this.npcs = Object.keys(NPC_DATA).map(id => ({
      id,
      ...NPC_DATA[id],
      currentX: NPC_DATA[id].x,
      currentY: NPC_DATA[id].y,
      targetX: NPC_DATA[id].x,
      targetY: NPC_DATA[id].y,
      moveTimer: Math.random() * 200,
      talking: false,
      emotion: null,
      emotionTimer: 0,
      animFrame: 0,
      animTimer: 0,
    }));

    // World items state
    this.worldItems = WORLD_ITEMS.map(wi => ({ ...wi, collected: false }));
    this.openedZones = ['yard', 'porch'];

    // Daily reward
    this.lastRewardDay = -1;

    // Random events
    this.todayEvent = null;

    // Cat corner upgrades
    this.catCorner = { pillow: false, bowl: false, canopy: false, rug: false, toy: false,
      lamp: false, flowers: false, sign: false, box: false, miniHouse: false };

    // Story progress
    this.storyProgress = 0;
    this.endingShown = false;

    // Setup
    this._setupResize();
    this._setupButtons();
    this._setupTelegramButtons();
    this._checkSave();
  }

  _setupResize() {
    const resize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 300));
    resize();
  }

  _setupButtons() {
    // iOS-safe tap handler: use both touchend and click, prevent double-fire
    const tap = (el, fn) => {
      if (!el) return;
      let touched = false;
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        touched = true;
        fn();
        setTimeout(() => { touched = false; }, 400);
      }, { passive: false });
      el.addEventListener('click', (e) => {
        if (!touched) fn();
      });
    };

    // Main menu
    tap(document.getElementById('btn-new-game'),  () => { if(this.audio)this.audio.uiClick(); this._startNew(); });
    tap(document.getElementById('btn-continue'),  () => { if(this.audio)this.audio.uiClick(); this._loadAndStart(); });
    tap(document.getElementById('btn-settings'),  () => { if(this.audio)this.audio.uiClick(); this.ui.openScreen('settings'); });
    tap(document.getElementById('btn-about'),     () => { if(this.audio)this.audio.uiClick(); this.ui.openScreen('about'); });

    // Pause
    tap(document.getElementById('btn-resume'),    () => { if(this.audio)this.audio.uiClick(); this.paused=false; this.ui.closeScreen('pause'); });
    tap(document.getElementById('btn-save'),      () => { if(this.audio)this.audio.uiClick(); this._saveGame(); this.ui.notify('💾 Игра сохранена!'); });
    tap(document.getElementById('btn-main-menu'), () => { if(this.audio)this.audio.uiClick(); this._goMainMenu(); });
    tap(document.getElementById('btn-settings2'), () => { if(this.audio)this.audio.uiClick(); this.ui.openScreen('settings'); });
    tap(document.getElementById('btn-reset'),     () => {
      if (confirm('Сбросить весь прогресс?')) { this.save.reset(); location.reload(); }
    });

    // HUD buttons
    tap(document.getElementById('btn-pause'),     () => {
      if(this.audio)this.audio.uiClick();
      this.paused = !this.paused;
      if (this.paused) this.ui.openScreen('pause'); else this.ui.closeScreen('pause');
    });
    tap(document.getElementById('btn-map'),       () => { if(this.audio)this.audio.uiClick(); this.ui.renderMap(ZONES, this.openedZones, this.player.x, this.player.y, this.npcs); this.ui.openScreen('map'); });
    tap(document.getElementById('btn-inventory'), () => { if(this.audio)this.audio.uiClick(); this.ui.renderInventory(this.inventory, ITEMS); this.ui.openScreen('inventory'); });
    tap(document.getElementById('btn-quests'),    () => { if(this.audio)this.audio.uiClick(); this.ui.renderQuests(this.quests); this.ui.openScreen('quests'); });
    tap(document.getElementById('btn-meow'),      () => { this._doMeow(); });
    tap(document.getElementById('btn-action'),    () => { this._doAction(); });

    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      tap(btn, () => {
        if(this.audio)this.audio.uiClick();
        this.ui.closeScreen(btn.dataset.close);
      });
    });

    // Quest tabs
    document.querySelectorAll('.quest-tab').forEach(tab => {
      tap(tab, () => {
        document.querySelectorAll('.quest-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.ui.renderQuests(this.quests);
      });
    });

    // Settings sliders
    const volMusic = document.getElementById('set-music');
    const volSfx   = document.getElementById('set-sfx');
    if (volMusic) volMusic.oninput = (e) => { if(this.audio) this.audio.musicVolume = e.target.value/100; };
    if (volSfx)   volSfx.oninput   = (e) => { if(this.audio) this.audio.sfxVolume   = e.target.value/100; };

    // Dialogue tap
    const dlgBox = document.getElementById('dialogue-box');
    if (dlgBox) {
      tap(dlgBox, () => { if(this.dialogue) this.dialogue.advance(); });
    }
    const dlgScr = document.getElementById('screen-dialogue');
    if (dlgScr) tap(dlgScr, () => { if(this.dialogue) this.dialogue.advance(); });

    // Inventory item use panel
    tap(document.getElementById('btn-use-item'),    () => { this.ui._useSelectedItem(this); });
    tap(document.getElementById('btn-cancel-item'), () => { this.ui._hideItemPanel(); });

    // Minigame close
    tap(document.getElementById('btn-minigame-close'), () => { if(this.minigame) this.minigame.close(); });

    // Draw title screen cat
    this._drawTitleCat();
  }

  _drawTitleCat() {
    const tc = document.getElementById('title-canvas');
    if (!tc) return;
    const ctx = tc.getContext('2d');
    const w = tc.width, h = tc.height;
    // Background circle
    const bg = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    bg.addColorStop(0,'#2d5a1b');
    bg.addColorStop(1,'#0a1a0a');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(w/2,h/2,w/2,0,Math.PI*2); ctx.fill();
    // Draw cat
    Draw.drawCat(ctx, w/2, h-8, 1, 0, false, true, false, 1.6);
  }

  _setupTelegramButtons() {
    this.telegram.onBackButton(() => {
      if (this.ui.activeScreen) {
        this.ui.closeScreen(this.ui.activeScreen);
      } else if (this.paused) {
        this.paused = false;
        this.ui.closeScreen('pause');
      } else if (this.gameStarted) {
        this.paused = true;
        this.ui.openScreen('pause');
      }
    });
  }

  _checkSave() {
    const hasSave = this.save.exists();
    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue) btnContinue.style.display = hasSave ? 'block' : 'none';
  }

  _startNew() {
    this.save.reset();
    this._initFreshGame();
    this._startGame();
  }

  _loadAndStart() {
    const data = this.save.load();
    if (!data) { this._startNew(); return; }
    this._applyLoadedData(data);
    this._startGame();
  }

  _initFreshGame() {
    this.player.x = 700;
    this.player.y = 500;
    this.player.stats = { hunger: 80, energy: 90, mood: 80, curiosity: 70, cleanliness: 90, fame: 0 };
    this.time.day = 1;
    this.time.gameTime = 9 * 3600;
    this.inventory.slots = {};
    this.quests.active = {};
    this.quests.completed = new Set();
    this.openedZones = ['yard', 'porch'];
    this.worldItems.forEach(wi => wi.collected = false);
    this.npcs.forEach(npc => { npc.trustLevel = 0; });
    this.achievements.unlocked = new Set();
    this.catCorner = Object.fromEntries(Object.keys(this.catCorner).map(k => [k, false]));
    this.storyProgress = 0;
    this.endingShown = false;
    this.lastRewardDay = -1;

    // Start first quest
    setTimeout(() => {
      this.quests.start('find_bowl');
      this.dialogue.queue([
        { speaker: 'ryzhik', text: 'Мяу! Просыпаюсь на свежем воздухе... Где же моя миска? Нужно найти её!', portrait: 'ryzhik' }
      ]);
    }, 2000);
  }

  _applyLoadedData(data) {
    if (data.player) {
      this.player.x = data.player.x || 700;
      this.player.y = data.player.y || 500;
      if (data.player.stats) this.player.stats = { ...this.player.stats, ...data.player.stats };
    }
    if (data.time) {
      this.time.day = data.time.day || 1;
      const h = data.time.hour || 9;
      const m = data.time.minutes || 0;
      this.time.gameTime = h * 3600 + m * 60;
    }
    if (data.inventory) {
      // slots can be array [{id,count}] or object {id:count}
      if (Array.isArray(data.inventory)) {
        this.inventory.slots = {};
        data.inventory.forEach(i => { if(i && i.id) this.inventory.slots[i.id] = i.count || 1; });
      } else {
        this.inventory.slots = data.inventory;
      }
    }
    if (data.quests) {
      this.quests.active = {};
      (data.quests.active || []).forEach(aq => { this.quests.active[aq.id] = aq; });
      this.quests.completed = new Set(data.quests.completed || []);
    }
    if (data.openedZones) this.openedZones = data.openedZones;
    if (data.worldItems) {
      data.worldItems.forEach(wid => {
        const wi = this.worldItems.find(w => w.id === wid);
        if (wi) wi.collected = true;
      });
    }
    if (data.npcs) {
      data.npcs.forEach(nd => {
        const npc = this.npcs.find(n => n.id === nd.id);
        if (npc) npc.trustLevel = nd.trust || 0;
      });
    }
    if (data.achievements) this.achievements.unlocked = new Set(data.achievements || []);
    if (data.catCorner) this.catCorner = { ...this.catCorner, ...data.catCorner };
    if (data.storyProgress !== undefined) this.storyProgress = data.storyProgress;
    this.lastRewardDay = data.lastRewardDay || -1;
  }

  _saveGame() {
    const data = {
      player: { x: this.player.x, y: this.player.y, stats: this.player.stats },
      time: { day: this.time.day, hour: Math.floor(this.time.gameTime/3600), minutes: Math.floor((this.time.gameTime%3600)/60) },
      inventory: this.inventory.slots, // object {itemId: count}
      quests: { active: Object.values(this.quests.active), completed: [...this.quests.completed] },
      openedZones: this.openedZones,
      worldItems: this.worldItems.filter(w => w.collected).map(w => w.id),
      npcs: this.npcs.map(n => ({ id: n.id, trust: n.trustLevel })),
      achievements: this.achievements.unlocked ? [...this.achievements.unlocked] : [],
      catCorner: this.catCorner,
      storyProgress: this.storyProgress,
      lastRewardDay: this.lastRewardDay,
      weather: this.weather.current,
    };
    this.save.save(data);
  }

  _startGame() {
    this.gameStarted = true;
    this.running = true;
    this.paused = false;

    // Hide main menu
    const mainMenu = document.getElementById('screen-main-menu');
    if (mainMenu) mainMenu.style.display = 'none';

    // Show game UI
    document.getElementById('mobile-ui').style.display = 'block';
    document.getElementById('hud').style.display = 'block';

    // Center camera
    this.camera.x = this.player.x - this.canvas.width / 2;
    this.camera.y = this.player.y - this.canvas.height / 2;

    // Start audio
    this.audio.startAmbience();

    // Telegram
    this.telegram.showMainButton('Сохранить', () => { this._saveGame(); this.ui.notify('💾 Сохранено!'); });

    // Daily reward
    this._checkDailyReward();

    // Random event
    this._pickDailyEvent();

    // Start loop
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  _goMainMenu() {
    this._saveGame();
    this.gameStarted = false;
    this.running = false;
    cancelAnimationFrame(this._rafId);
    this.ui.closeScreen('pause');
    const mainMenu = document.getElementById('screen-main-menu');
    if (mainMenu) mainMenu.style.display = 'flex';
    document.getElementById('mobile-ui').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    this._checkSave();
  }

  _checkDailyReward() {
    if (this.time.day !== this.lastRewardDay) {
      this.lastRewardDay = this.time.day;
      const rewards = ['fish', 'apple', 'coin', 'pebble', 'seeds', 'dry_food'];
      const r = rewards[Math.floor(Math.random() * rewards.length)];
      setTimeout(() => {
        this.inventory.add(r);
        this.ui.notify(`🎁 Ежедневная награда: ${ITEMS[r]?.name || r}!`);
        this.telegram.haptic('light');
      }, 3000);
    }
  }

  _pickDailyEvent() {
    const events = [
      { id: 'guests', text: '👥 К дому приехали гости!' },
      { id: 'rain', text: '🌧 Сегодня будет дождь...' },
      { id: 'box', text: '📦 Во дворе появилась новая коробка!' },
      { id: 'crow', text: '🦅 Ворона принесла что-то блестящее!' },
      { id: 'baron', text: '🐕 Барон спрятал косточку где-то во дворе' },
      { id: 'pie', text: '🥧 Бабушка испекла пирог — вкусно пахнет!' },
      { id: 'ducks', text: '🦆 На пруду появились утки!' },
      { id: 'barn_noise', text: '🚪 Из сарая доносятся странные звуки...' },
      { id: 'fireflies', text: '✨ Ночью появятся светлячки!' },
    ];
    this.todayEvent = events[Math.floor(Math.random() * events.length)];
    setTimeout(() => {
      if (this.todayEvent) this.ui.notify(this.todayEvent.text);
    }, 5000);

    // Apply event effects
    if (this.todayEvent?.id === 'rain') {
      this.weather.current = 'rain';
    } else if (this.todayEvent?.id === 'ducks') {
      this.openedZones.push('pond');
    }
  }

  _doMeow() {
    this.audio.meow();
    this.player.isMeowing = true;
    this.player.meowTimer = 60;
    if (this.achievements) this.achievements.check('first_meow', this);
    this.player.stats.mood = Math.min(100, this.player.stats.mood + 2);
    this.telegram.haptic('light');

    // Wake up nearby sleeping NPCs
    this.npcs.forEach(npc => {
      const dx = npc.currentX - this.player.x;
      const dy = npc.currentY - this.player.y;
      if (Math.sqrt(dx*dx+dy*dy) < 120) {
        npc.emotion = 'surprise';
        npc.emotionTimer = 90;
      }
    });

    // Show meow bubble
    this.ui.notify('😺 Мяу!');
  }

  _doAction() {
    this.telegram.haptic('light');

    // Dialogue advance if active
    if (this.dialogue.isActive()) {
      this.dialogue.advance();
      return;
    }

    // Find nearest interactable
    const range = 80;
    let nearest = null;
    let nearestDist = range;

    // Check NPCs
    this.npcs.forEach(npc => {
      const dx = npc.currentX - this.player.x;
      const dy = npc.currentY - this.player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { type: 'npc', data: npc };
      }
    });

    // Check world items
    this.worldItems.forEach(wi => {
      if (wi.collected) return;
      const dx = wi.x - this.player.x;
      const dy = wi.y - this.player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { type: 'item', data: wi };
      }
    });

    // Check world objects
    WORLD_OBJECTS.forEach(obj => {
      const dx = obj.x - this.player.x;
      const dy = obj.y - this.player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < nearestDist + 20) {
        nearestDist = dist;
        nearest = { type: 'object', data: obj };
      }
    });

    if (!nearest) {
      // Nothing nearby
      this._doMeow();
      return;
    }

    if (nearest.type === 'npc') {
      this._interactNPC(nearest.data);
    } else if (nearest.type === 'item') {
      this._pickupItem(nearest.data);
    } else if (nearest.type === 'object') {
      this._interactObject(nearest.data);
    }
  }

  _interactNPC(npc) {
    const tod = this.time.getTimeOfDay();
    const dialogs = npc.dialogs?.[tod] || npc.dialogs?.day || ['Мяу! (NPC молчит)'];
    const text = Array.isArray(dialogs) ? dialogs[Math.floor(Math.random() * dialogs.length)] : dialogs;

    npc.trustLevel = Math.min(100, (npc.trustLevel || 0) + 2);
    npc.emotion = 'happy';
    npc.emotionTimer = 120;

    this.dialogue.queue([
      { speaker: npc.id, name: NPC_DATA[npc.id]?.name || npc.id, text, portrait: npc.id, color: npc.color }
    ]);

    if (this.achievements) this.achievements.check('first_friend', this);

    // Quest trigger
    const q = QUESTS[npc.quest];
    if (q && !this.quests.completed.includes(npc.quest) && !this.quests.active[npc.quest]) {
      if (npc.trustLevel >= 10) {
        setTimeout(() => {
          this.quests.start(npc.quest);
          this.dialogue.queue([
            { speaker: npc.id, name: NPC_DATA[npc.id]?.name, text: q.description, portrait: npc.id, color: npc.color }
          ]);
        }, 2000);
      }
    }
  }

  _pickupItem(wi) {
    wi.collected = true;
    const item = ITEMS[wi.itemId];
    this.inventory.add(wi.itemId);
    this.audio.pickup();
    this.telegram.haptic('medium');
    this.ui.notify(`✨ Поднял: ${item?.name || wi.itemId}`);
    this.player.stats.curiosity = Math.min(100, this.player.stats.curiosity + 3);

    // Quest progress
    Object.values(this.quests.active).forEach(aq => {
      const qdata = QUESTS[aq.id];
      if (qdata?.collectItem === wi.itemId) {
        this.quests.progress('collect', wi.itemId, 1, {});
      }
    });

    if (this.achievements) this.achievements.check('collector', this);
  }

  _interactObject(obj) {
    if (obj.id === 'well') {
      this.player.stats.cleanliness = 100;
      this.ui.notify('💧 Рыжик умылся у колодца!');
      this.audio.pickup();
    } else if (obj.id === 'campfire') {
      this.player.stats.mood = Math.min(100, this.player.stats.mood + 10);
      this.player.stats.energy = Math.min(100, this.player.stats.energy + 5);
      this.ui.notify('🔥 Тепло у костра... настроение улучшилось!');
    } else if (obj.id === 'cat_corner') {
      this.player.stats.energy = Math.min(100, this.player.stats.energy + 20);
      this.player.stats.mood = Math.min(100, this.player.stats.mood + 15);
      this.ui.notify('🐱 Кошачий уголок — лучшее место для отдыха!');
      this.player.isSleeping = true;
      setTimeout(() => { this.player.isSleeping = false; }, 3000);
    } else if (obj.id === 'pond') {
      if (this.inventory.has('fishing_rod') || this.quests.active.find(a => a.id === 'fishing')) {
        this.minigame.start('fishing');
      } else {
        this.ui.notify('🐟 Рыжик смотрит на пруд... Нужна удочка!');
      }
    } else if (obj.id === 'greenhouse') {
      if (this.inventory.has('barn_key') || this.openedZones.includes('greenhouse')) {
        this.openedZones.push('greenhouse');
        this.ui.notify('🌿 Теплица открылась! Внутри что-то сверкает...');
        this.storyProgress = Math.max(this.storyProgress, 3);
        this.quests.start('open_greenhouse');
      } else {
        this.ui.notify('🔒 Теплица заперта. Нужен ключ...');
        this.dialogue.queue([{ speaker: 'ryzhik', text: 'Теплица закрыта... Кто-то должен знать, где ключ.', portrait: 'ryzhik' }]);
      }
    } else if (obj.id === 'barn') {
      if (this.inventory.has('barn_key') || this.openedZones.includes('barn')) {
        this.openedZones.push('barn');
        this.ui.notify('🚪 Сарай открыт!');
        this.quests.progress('collect', 'barn_key', 1, {});
      } else {
        this.ui.notify('🔒 Сарай заперт. Нужен ключ!');
      }
    } else if (obj.id === 'house') {
      this.ui.notify('🏠 Родной дом... Рыжик любит этот дом.');
    } else if (obj.id === 'gate') {
      if (this.openedZones.includes('forest_path')) {
        this.ui.notify('🌿 Ворота в лес открыты!');
      } else {
        this.ui.notify('🔒 Ворота закрыты. Нужно найти тропу.');
      }
    } else {
      this.ui.notify(`🔍 Рыжик осматривает ${obj.id}...`);
    }
  }

  _updateNPCMovement(dt) {
    const tod = this.time.getTimeOfDay();
    this.npcs.forEach(npc => {
      // Update target based on schedule
      const schedulePos = npc.schedule?.[tod];
      if (schedulePos) {
        npc.targetX = schedulePos.x;
        npc.targetY = schedulePos.y;
      }

      // Move timer
      npc.moveTimer -= dt * 60;
      if (npc.moveTimer <= 0) {
        npc.moveTimer = 150 + Math.random() * 200;
        // Small random wander around target
        const wx = (npc.targetX || npc.x) + (Math.random() - 0.5) * 80;
        const wy = (npc.targetY || npc.y) + (Math.random() - 0.5) * 80;
        npc.wander = { x: Math.max(50, Math.min(2750, wx)), y: Math.max(50, Math.min(1750, wy)) };
      }

      // Smooth movement
      const tx = npc.wander?.x || npc.targetX || npc.x;
      const ty = npc.wander?.y || npc.targetY || npc.y;
      const dx = tx - npc.currentX;
      const dy = ty - npc.currentY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 2) {
        const speed = 0.5;
        npc.currentX += (dx / dist) * speed * dt * 60;
        npc.currentY += (dy / dist) * speed * dt * 60;
        npc.facing = dx > 0 ? 1 : -1;
        npc.animTimer = (npc.animTimer || 0) + dt * 60;
        if (npc.animTimer > 12) { npc.animFrame = ((npc.animFrame || 0) + 1) % 4; npc.animTimer = 0; }
      }

      // Emotion timer
      if (npc.emotionTimer > 0) npc.emotionTimer -= dt * 60;
      else npc.emotion = null;
    });
  }

  _updatePlayerStats(dt) {
    const p = this.player;
    // Slow stat decay
    p.stats.hunger = Math.max(0, p.stats.hunger - 0.005 * dt * 60);
    p.stats.energy = Math.max(0, p.stats.energy - 0.003 * dt * 60);
    p.stats.cleanliness = Math.max(0, p.stats.cleanliness - 0.002 * dt * 60);

    // Mood influenced by hunger and energy
    if (p.stats.hunger < 20) p.stats.mood = Math.max(0, p.stats.mood - 0.01 * dt * 60);
    if (p.stats.energy < 20) p.stats.mood = Math.max(0, p.stats.mood - 0.005 * dt * 60);

    // Speed modifier
    p.speedMultiplier = p.stats.energy < 20 ? 0.5 : 1;

    // Use food from inventory
    if (p.stats.hunger < 30 && this.inventory.has('fish')) {
      this.inventory.remove('fish');
      p.stats.hunger = Math.min(100, p.stats.hunger + 40);
      this.ui.notify('🐟 Рыжик съел рыбку!');
    } else if (p.stats.hunger < 20 && this.inventory.has('dry_food')) {
      this.inventory.remove('dry_food');
      p.stats.hunger = Math.min(100, p.stats.hunger + 25);
      this.ui.notify('🍖 Рыжик поел сухой корм');
    }

    this.ui.updateStats(p.stats);
  }

  _updateActionHint() {
    const range = 80;
    let nearest = null;
    let nearestDist = range;
    let hint = '';

    this.npcs.forEach(npc => {
      const dx = npc.currentX - this.player.x;
      const dy = npc.currentY - this.player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < nearestDist) { nearestDist = dist; nearest = { type: 'npc', name: npc.name }; }
    });

    this.worldItems.forEach(wi => {
      if (wi.collected) return;
      const dx = wi.x - this.player.x;
      const dy = wi.y - this.player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < nearestDist) { const _iid = wi.itemId || wi.item; nearestDist = dist; nearest = { type: 'item', name: ITEMS[_iid]?.name || _iid }; }
    });

    WORLD_OBJECTS.forEach(obj => {
      const dx = obj.x - this.player.x;
      const dy = obj.y - this.player.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < nearestDist + 20) { nearestDist = dist; nearest = { type: 'object', name: obj.id }; }
    });

    if (nearest) {
      if (nearest.type === 'npc') hint = `💬 Поговорить с ${nearest.name}`;
      else if (nearest.type === 'item') hint = `✨ Поднять: ${nearest.name}`;
      else hint = `🔍 Осмотреть`;
    }

    this.ui.updateActionHint(hint);
  }

  _checkZoneUnlock() {
    const p = this.player;
    Object.values(ZONES).forEach(zone => {
      if (this.openedZones.includes(zone.id)) return;
      const dx = p.x - zone.x;
      const dy = p.y - zone.y;
      if (Math.sqrt(dx*dx + dy*dy) < (zone.radius || 150)) {
        if (zone.unlocked !== false) {
          this.openedZones.push(zone.id);
          this.ui.notify(`🗺 Открыта новая зона: ${zone.name}!`);
          if (this.achievements) this.achievements.check('explorer', this);
          Object.values(this.quests.active).forEach(aq => {
            if (QUESTS[aq.id]?.unlockZone === zone.id) this.quests.progress(aq.id, this);
          });
        }
      }
    });
  }

  _checkStoryProgress() {
    const completed = this.quests.completed.length;
    if (completed >= 5 && this.storyProgress < 1) {
      this.storyProgress = 1;
      this.dialogue.queue([{ speaker: 'ryzhik', text: 'Я начинаю узнавать все секреты этого двора...', portrait: 'ryzhik' }]);
    }
    if (completed >= 15 && this.storyProgress < 2) {
      this.storyProgress = 2;
      this.dialogue.queue([{ speaker: 'ryzhik', text: 'Все говорят о старой теплице. Что же там внутри?', portrait: 'ryzhik' }]);
    }
    if (this.quests.completed.includes('open_greenhouse') && this.storyProgress < 4) {
      this.storyProgress = 4;
      this.quests.start('sun_bell_quest');
    }
    if (this.quests.completed.includes('sun_bell_quest') && !this.endingShown) {
      this._triggerEnding();
    }
  }

  _triggerEnding() {
    this.endingShown = true;
    this.paused = true;

    // Build ending screen content
    const endScreen = document.getElementById('screen-about');
    if (endScreen) {
      endScreen.querySelector('h2').textContent = '🌟 Конец истории';
      endScreen.querySelector('p, div').innerHTML = `
        <div style="text-align:center; padding:20px; color:#fff;">
          <div style="font-size:48px; margin:10px">🐱✨🌸</div>
          <h3 style="color:#ffd700">Рыжик нашёл Солнечный колокольчик!</h3>
          <p>Тихим летним вечером весь двор собрался у дома.</p>
          <p>Бабушка поставила Рыжику новую миску.</p>
          <p>Барон больше не ворчит. Муся мурлыкает рядом.</p>
          <p>Двор наполнился светлячками и теплом.</p>
          <p style="color:#ffd700; margin-top:15px">🏠 Дом снова стал уютным. 🏠</p>
          <p style="margin-top:10px; opacity:0.7">Открыт свободный режим!</p>
        </div>`;
      this.ui.openScreen('about');
    }

    this.achievements.unlock('greenhouse_keeper', this);
    this.achievements.unlock('true_master', this);
    this.audio.questComplete();
    this.telegram.haptic('success');

    // Resume free mode after closing
    setTimeout(() => {
      this.paused = false;
      this.ui.notify('🎉 Свободный режим активирован!');
    }, 8000);
  }

  _loop(timestamp) {
    this._rafId = requestAnimationFrame(ts => this._loop(ts));

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    // FPS counter
    this._fpsCounter++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 1) {
      this.fps = this._fpsCounter;
      this._fpsCounter = 0;
      this._fpsTimer = 0;
    }

    if (!this.running || this.minigame.active) return;
    if (this.paused && !this.dialogue.isActive()) return;

    this._update(dt);
    this._render();
  }

  _update(dt) {
    // Time & weather
    this.time.update(dt);
    this.weather.update(dt);

    // Day change
    if (this.time.justChangedDay) {
      this.time.justChangedDay = false;
      this._checkDailyReward();
      this._pickDailyEvent();
      this._saveGame();
    }

    // Player movement
    const dir = this.mobile.getMoveDir();
    let mx = dir.x, my = dir.y;
    if (!mx && !my) {
      if (this.input.keys['ArrowLeft'] || this.input.keys['a'] || this.input.keys['A']) mx -= 1;
      if (this.input.keys['ArrowRight'] || this.input.keys['d'] || this.input.keys['D']) mx += 1;
      if (this.input.keys['ArrowUp'] || this.input.keys['w'] || this.input.keys['W']) my -= 1;
      if (this.input.keys['ArrowDown'] || this.input.keys['s'] || this.input.keys['S']) my += 1;
    }

    if (!this.dialogue.isActive() && !this.ui.activeScreen) {
      this.player.move(mx, my, dt, this.canvas.width, this.canvas.height);
    }

    // Keyboard shortcuts
    if (this.input.consume('KeyE') || this.input.consume('Space')) this._doAction();
    if (this.input.consume('KeyI')) this.ui.openScreen('inventory');
    if (this.input.consume('KeyM')) this.ui.openScreen('map');
    if (this.input.consume('KeyQ')) this.ui.openScreen('quests');
    if (this.input.consume('Escape')) {
      if (this.ui.activeScreen) this.ui.closeScreen(this.ui.activeScreen);
      else { this.paused = !this.paused; if (this.paused) this.ui.openScreen('pause'); }
    }

    // Camera
    this.camera.follow(this.player.x, this.player.y, this.canvas.width, this.canvas.height, 2800, 1800);

    // NPC AI
    this._updateNPCMovement(dt);

    // Stats
    this._updatePlayerStats(dt);

    // Action hint
    this._updateActionHint();

    // Zone unlock
    this._checkZoneUnlock();

    // Story
    this._checkStoryProgress();

    // Time display
    this.ui.updateTime(this.time);

    // Quest hint
    const aq = Object.values(this.quests.active)[0];
    if (aq && QUESTS[aq.id]) this.ui.updateQuestHint(QUESTS[aq.id].title || '');

    // Minimap
    this.ui.renderMinimap(ZONES, this.openedZones, this.player.x, this.player.y, this.camera.x, this.camera.y, this.canvas.width, this.canvas.height);

    // Dialogue
    this.dialogue.update(dt);
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // World
    this.world.render(ctx, this.camera, this.time, this.weather, ZONES, this.worldItems, this.npcs, this.player, performance.now()/1000);

    ctx.restore();

    // Camera shake
    if (this.camera.shake > 0) {
      ctx.save();
      const sx = (Math.random() - 0.5) * this.camera.shake * 2;
      const sy = (Math.random() - 0.5) * this.camera.shake * 2;
      ctx.translate(sx, sy);
      ctx.restore();
      this.camera.shake -= 0.5;
    }

    // Dialogue overlay
    this.dialogue.render(ctx, w, h);
  }
}

// ============================================================
// BOOT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
