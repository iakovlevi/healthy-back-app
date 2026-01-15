import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, SkipForward, CheckCircle, Activity, ChevronRight, Home, BarChart2, Clock, Award, RotateCcw, Plus, X, AlertTriangle, Dumbbell, Zap, Moon, Sun, Trophy, BookOpen, User, Calendar, Lock, Star, Shield, Flame, Sword, Battery, ClipboardList, HelpCircle, Repeat, Brain, ArrowLeft, LogOut, Loader, LayoutGrid } from 'lucide-react';


// --- CONFIGURATION ---
// ПРИМЕЧАНИЕ ДЛЯ ДЕПЛОЯ:
// Вставьте сюда URL вашей публичной функции Yandex Cloud после деплоя бэкенда.
// Если оставить пустым или как есть, приложение будет работать в демо-режиме (использовать mock-api).
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "https://d5df48d7k10crckljv6m.g3ab4gln.apigw.yandexcloud.net";


// --- SOUND UTILS ---
const playSound = (type) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'tick') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'finish') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'levelup') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        }
    } catch (e) {
        console.error("Audio error", e);
    }
};

const trackEvent = (name, params = {}) => {
    console.log('[ANALYTICS]', name, params);
};

// --- DATA: EXERCISES & WORKOUTS ---

const EXERCISES = {
    // Relax
    suboccipital_release: { id: 'suboccipital_release', title: 'Релиз основания черепа', equipment: 'Сдвоенный мяч', description: 'Положите сдвоенный мяч под основание черепа. Лежите неподвижно или делайте легкие кивки "Да-Да".', duration: 90, type: 'relax' },
    upper_traps_ball: { id: 'upper_traps_ball', title: 'Проработка трапеции', equipment: 'Одинарный мяч', description: 'Встаньте у стены, поместите мяч между стеной и верхней частью трапеции.', duration: 60, type: 'relax' },
    thoracic_roll: { id: 'thoracic_roll', title: 'Прокатка грудного отдела', equipment: 'Деревянный ролл', description: 'Катайте ролл от низа лопаток до основания шеи. Не заходите на поясницу!', duration: 120, type: 'relax' },
    glute_roll: { id: 'glute_roll', title: 'МФР Ягодичных мышц', equipment: 'Деревянный ролл', description: 'Сядьте на ролл одной ягодицей, согнув ногу. Катайтесь медленно.', duration: 90, type: 'relax' },
    sacrum_release: { id: 'sacrum_release', title: 'Релиз крестца', equipment: 'Сдвоенный мяч', description: 'Положите мяч под крестец. Подтяните колени к груди.', duration: 60, type: 'relax' },

    // Strength
    dumbbell_row: { id: 'dumbbell_row', title: 'Тяга гантели в наклоне', equipment: 'Гантель', description: 'Опора рукой о стул. Спина прямая. Тяните гантель к поясу.', duration: 45, isStrength: true, type: 'strength' },
    goblet_squat: { id: 'goblet_squat', title: 'Кубковые приседания', equipment: 'Гантель', description: 'Держите гантель у груди. Ноги чуть шире плеч. Приседайте.', duration: 60, isStrength: true, type: 'strength' },
    romanian_deadlift: { id: 'romanian_deadlift', title: 'Румынская тяга', equipment: '2 Гантели', description: 'Отводите таз назад, наклоняясь с прямой спиной.', duration: 60, isStrength: true, type: 'strength' },
    overhead_press: { id: 'overhead_press', title: 'Жим гантелей стоя', equipment: '2 Гантели', description: 'Выжимайте гантели вверх, не прогибаясь сильно в пояснице.', duration: 45, isStrength: true, type: 'strength' },
    floor_press: { id: 'floor_press', title: 'Жим гантелей с пола', equipment: '2 Гантели', description: 'Лежа на спине, жмите гантели вверх.', duration: 60, isStrength: true, type: 'strength' },
    lunges: { id: 'lunges', title: 'Выпады назад', equipment: '2 Гантели', description: 'Делайте шаг назад, опуская колено почти до пола.', duration: 60, isStrength: true, type: 'strength' },

    // Mobility
    thoracic_extension: { id: 'thoracic_extension', title: 'Разгибание на ролле', equipment: 'Деревянный ролл', description: 'Зафиксируйте ролл под лопатками. На вдохе прогнитесь назад.', duration: 60, type: 'mobility' },
    cat_cow: { id: 'cat_cow', title: 'Кошка-Корова', equipment: 'Коврик', description: 'Вдох - прогиб, взгляд вверх. Выдох - округление спины.', duration: 60, type: 'mobility' },
    child_pose: { id: 'child_pose', title: 'Поза ребенка', equipment: 'Коврик', description: 'Сядьте тазом на пятки, руки вытяните вперед.', duration: 45, type: 'mobility' }
};

const WORKOUTS = [
    { id: 'neck_rescue', title: 'Спасение шеи', subtitle: 'При головной боли и зажимах', duration: '5 мин', intensity: 'Лёгкая', type: 'relax', targets: ['Шея', 'Головная боль'], color: 'bg-blue-100 text-blue-800', exercises: ['suboccipital_release', 'upper_traps_ball', 'thoracic_roll'] },
    { id: 'back_relief', title: 'Вся спина (МФР)', subtitle: 'Снять усталость спины', duration: '12 мин', intensity: 'Средняя', type: 'relax', targets: ['Поясница', 'Лопатки', 'Ягодицы'], color: 'bg-teal-100 text-teal-800', exercises: ['thoracic_roll', 'thoracic_extension', 'glute_roll', 'glute_roll', 'sacrum_release', 'child_pose'] },
    { id: 'full_body_strength', title: 'Сила: Все тело', subtitle: 'Базовая силовая с гантелями', duration: '20 мин', intensity: 'Высокая', type: 'strength', targets: ['Общий тонус'], color: 'bg-rose-100 text-rose-800', exercises: ['goblet_squat', 'romanian_deadlift', 'dumbbell_row', 'dumbbell_row', 'floor_press', 'overhead_press'] },
    { id: 'posture_builder', title: 'Сила: Осанка и Спина', subtitle: 'Акцент на мышцы спины', duration: '15 мин', intensity: 'Средняя', type: 'strength', targets: ['Лопатки', 'Поясница'], color: 'bg-indigo-100 text-indigo-800', exercises: ['dumbbell_row', 'dumbbell_row', 'romanian_deadlift', 'thoracic_extension', 'cat_cow'] },
    { id: 'morning_mobility', title: 'Утренняя зарядка', subtitle: 'Проснуться без боли', duration: '4 мин', intensity: 'Лёгкая', type: 'mobility', targets: ['Скованность'], color: 'bg-orange-100 text-orange-800', exercises: ['cat_cow', 'thoracic_extension', 'child_pose'] }
];

const ACHIEVEMENTS_META = [
    { id: 'first_step', title: 'Новичок', desc: 'Завершите 1 тренировку', icon: '🥚', category: 'starter' },
    { id: 'consistency_3', title: 'Любитель', desc: '3 тренировки', icon: '🐣', category: 'starter' },
    { id: 'workout_5', title: 'Адепт', desc: '5 тренировок', icon: '🥉', category: 'volume' },
    { id: 'workout_10', title: 'Воин', desc: '10 тренировок', icon: '🥈', category: 'volume' },
    { id: 'workout_25', title: 'Ветеран', desc: '25 тренировок', icon: '🥇', category: 'volume' },
    { id: 'weight_5', title: 'Легкий вес', desc: 'Взять гантель 5 кг', icon: '🧱', category: 'strength' },
    { id: 'weight_10', title: 'Средний вес', desc: 'Взять гантель 10 кг', icon: '⚓', category: 'strength' },
    { id: 'weight_15', title: 'Тяжелый вес', desc: 'Взять гантель 15 кг', icon: '🚜', category: 'strength' },
    { id: 'streak_3', title: 'Серия: 3 дня', desc: '3 дня подряд', icon: '🔥', category: 'streak' },
    { id: 'streak_7', title: 'Неделя спорта', desc: '7 дней подряд', icon: '🗓️', category: 'streak' },
    { id: 'early_bird', title: 'Жаворонок', desc: 'Тренировка до 9 утра', icon: '🌅', category: 'timing' },
    { id: 'night_owl', title: 'Сова', desc: 'Тренировка после 21:00', icon: '🦉', category: 'timing' },
    { id: 'strength_master', title: 'Берсерк', desc: '5 силовых тренировок', icon: '⚔️', category: 'strength' },
    { id: 'relax_guru', title: 'Монах', desc: '5 МФР тренировок', icon: '🧘', category: 'type' },
    { id: 'pain_tracker', title: 'Ученый', desc: '10 записей в дневник', icon: '📜', category: 'data' },
    { id: 'pain_killer', title: 'Исцеление', desc: 'Боль ушла после занятия', icon: '💊', category: 'data' }
];

const checkAchievementConditions = (id, history, logs, weights) => {
    const totalWorkouts = history.length;
    const strengthCount = history.filter(h => WORKOUTS.find(w => w.id === h.workoutId)?.type === 'strength').length;
    const relaxCount = history.filter(h => WORKOUTS.find(w => w.id === h.workoutId)?.type === 'relax').length;
    const maxWeight = Math.max(0, ...Object.values(weights).map(Number));
    const dates = [...new Set(history.map(h => new Date(h.date).toDateString()))].map(d => new Date(d).getTime()).sort((a, b) => b - a);
    let currentStreak = dates.length > 0 ? 1 : 0;
    for (let i = 0; i < dates.length - 1; i++) {
        if ((dates[i] - dates[i + 1]) / 86400000 <= 1.1) currentStreak++;
        else break;
    }
    const hasPainDrop = logs.some(l => l.context === 'post' && logs.some(pre => pre.context === 'pre' && Math.abs(new Date(pre.date) - new Date(l.date)) < 3600000 && (pre.level - l.level) >= 2));

    switch (id) {
        case 'first_step': return totalWorkouts >= 1;
        case 'consistency_3': return totalWorkouts >= 3;
        case 'workout_5': return totalWorkouts >= 5;
        case 'workout_10': return totalWorkouts >= 10;
        case 'workout_25': return totalWorkouts >= 25;
        case 'weight_5': return maxWeight >= 5;
        case 'weight_10': return maxWeight >= 10;
        case 'weight_15': return maxWeight >= 15;
        case 'streak_3': return currentStreak >= 3;
        case 'streak_7': return currentStreak >= 7;
        case 'early_bird': return history.some(h => new Date(h.date).getHours() < 9);
        case 'night_owl': return history.some(h => new Date(h.date).getHours() >= 21);
        case 'strength_master': return strengthCount >= 5;
        case 'relax_guru': return relaxCount >= 5;
        case 'pain_tracker': return logs.length >= 10;
        case 'pain_killer': return hasPainDrop;
        default: return false;
    }
};

// --- AUTH UTILS ---
const apiRequest = async (endpoint, method = 'GET', body = null, token = null, baseUrl = API_BASE_URL) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Fallback if API_BASE_URL is not set (Demo Mode)
    if (baseUrl.includes("YOUR_YANDEX")) {
        return mockApi(endpoint, method, body);
    }

    try {
        const fullUrl = `${baseUrl}${endpoint}`;
        console.log(`[API REQUEST] ${method} ${fullUrl}`);
        const res = await fetch(fullUrl, { method, headers, body: body ? JSON.stringify(body) : null });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'API Error');
        }
        return await res.json();
    } catch (e) {
        console.error('[API FETCH ERROR]:', e);
        throw e;
    }
};

// Mock API for preview without backend
const mockApi = (endpoint, method, body) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (endpoint === '/auth/login') {
                localStorage.setItem('user_token', 'mock_token');
                resolve({ token: 'mock_token', user: { email: body.email } });
            } else if (endpoint === '/auth/register') {
                resolve({ token: 'mock_token', user: { email: body.email } });
            } else if (endpoint === '/data/sync') {
                resolve({
                    history: JSON.parse(localStorage.getItem('mfr_history') || '[]'),
                    painLogs: JSON.parse(localStorage.getItem('mfr_pain') || '[]'),
                    weights: JSON.parse(localStorage.getItem('mfr_weights') || '{}'),
                    achievements: JSON.parse(localStorage.getItem('mfr_achievements_v2') || '[]'),
                    readinessLogs: JSON.parse(localStorage.getItem('mfr_readiness') || '[]')
                });
            } else {
                resolve({});
            }
        }, 500);
    });
};

const AuthScreen = ({ onLogin, apiClient = apiRequest }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const data = await apiClient(endpoint, 'POST', { email, password });
            onLogin(data.token, data.user);
        } catch (err) {
            setError(err.message || "Ошибка соединения");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
                <div className="flex justify-center mb-6 text-teal-600">
                    <Activity size={48} />
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Здоровая Спина</h2>
                <p className="text-center text-slate-500 mb-8 text-sm">Ваш личный реабилитолог</p>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs mb-4 flex items-center"><AlertTriangle size={14} className="mr-2" />{error}</div>}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="name@example.com" required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Пароль</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none" placeholder="••••••••" required />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl hover:bg-teal-700 transition-colors flex justify-center">
                        {loading ? <Loader className="animate-spin" size={20} /> : (isLogin ? 'Войти' : 'Зарегистрироваться')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-slate-500 hover:text-teal-600">
                        {isLogin ? 'Нет аккаунта? Создать' : 'Есть аккаунт? Войти'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENTS ---

const Header = ({ level, xp, xpToNext, onLogout }) => (
    <header className="p-4 bg-white shadow-sm sticky top-0 z-20 border-b border-slate-100">
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
                    {level}
                </div>
                <div>
                    <h1 className="text-sm font-bold text-slate-800">Атлет</h1>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Уровень подготовки</p>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100 flex items-center space-x-1">
                    <Activity size={14} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-600">{xp} XP</span>
                </div>
                <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
            </div>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000" style={{ width: `${(xp / xpToNext) * 100}%` }}></div>
        </div>
    </header>
);

const TabNav = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'home', icon: Home, label: 'Сегодня' },
        { id: 'workouts', icon: BookOpen, label: 'Каталог' },
        { id: 'stats', icon: User, label: 'Профиль' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-20 pb-safe">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center space-y-1 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

const WorkoutsView = ({ startWorkout, listState, onListStateChange }) => {
    const { filter = 'program', selectedCategory = null, scrollTop = 0 } = listState || {};
    const scrollRef = useRef(null);

    // Apply saved scroll position
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollTop;
        }
    }, []);

    const setFilter = (newFilter) => {
        onListStateChange({ ...listState, filter: newFilter, selectedCategory: null, scrollTop: 0 });
    };

    const setSelectedCategory = (newCategory) => {
        onListStateChange({ ...listState, selectedCategory: newCategory, scrollTop: 0 });
    };

    const handleScroll = (e) => {
        onListStateChange({ ...listState, scrollTop: e.target.scrollTop });
    };

    const groups = {
        strength: { id: 'strength', label: 'Силовые', icon: <Dumbbell size={32} />, color: 'text-rose-600 bg-rose-50 border-rose-100', list: [] },
        relax: { id: 'relax', label: 'МФР и Релакс', icon: <RotateCcw size={32} />, color: 'text-teal-600 bg-teal-50 border-teal-100', list: [] },
        mobility: { id: 'mobility', label: 'Мобильность', icon: <Activity size={32} />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', list: [] }
    };

    // Populate Groups
    if (filter === 'program') {
        WORKOUTS.forEach(w => {
            if (groups[w.type]) groups[w.type].list.push(w);
        });
    } else {
        Object.values(EXERCISES).forEach(ex => {
            if (groups[ex.type]) groups[ex.type].list.push(ex);
        });
    }

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="p-6 space-y-4 pb-24 h-screen overflow-y-auto animate-in slide-in-from-right"
        >
            <h2 className="text-xl font-bold text-slate-800">Каталог</h2>

            {/* Type Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                <button onClick={() => setFilter('program')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'program' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Программы</button>
                <button onClick={() => setFilter('single')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'single' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Упражнения</button>
            </div>

            <div className="space-y-3">
                {!selectedCategory ? (
                    // 1. CATEGORY SELECTION VIEW
                    <div className="grid grid-cols-1 gap-4">
                        {Object.values(groups).map(group => (
                            <div
                                key={group.id}
                                onClick={() => setSelectedCategory(group.id)}
                                className={`p-6 rounded-2xl border flex items-center justify-between cursor-pointer active:scale-95 transition-transform ${group.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-50 ')}`}
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={`p-3 rounded-full bg-white shadow-sm ${group.color.split(' ')[0]}`}>{group.icon}</div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{group.label}</h3>
                                        <p className="text-xs text-slate-500 font-medium">{group.list.length} {filter === 'program' ? 'программ' : 'упражнений'}</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-slate-400" />
                            </div>
                        ))}
                    </div>
                ) : (
                    // 2. DETAILED LIST VIEW
                    <div className="animate-in slide-in-from-right">
                        <button
                            data-testid="workouts-back-button"
                            onClick={() => setSelectedCategory(null)}
                            className="flex items-center text-sm font-bold text-slate-500 mb-4 hover:text-slate-800 transition-colors"
                        >
                            <ArrowLeft size={16} className="mr-1" /> Назад к категориям
                        </button>

                        <div className={`flex items-center space-x-2 mb-4 px-2 py-1 rounded w-fit ${groups[selectedCategory].color}`}>
                            {React.cloneElement(groups[selectedCategory].icon, { size: 16 })}
                            <span className="font-bold text-sm">{groups[selectedCategory].label}</span>
                        </div>

                        <div className="space-y-3">
                            {groups[selectedCategory].list.length === 0 ? (
                                <div className="text-center text-slate-400 py-8 text-sm">В этой категории пока пусто</div>
                            ) : (
                                groups[selectedCategory].list.map(item => (
                                    <div
                                        key={item.id}
                                        data-testid={`workout-item-${item.id}`}
                                        onClick={() => {
                                            const workoutPayload = filter === 'program'
                                                ? item
                                                : { id: `single_${item.id}`, title: item.title, exercises: [item.id], color: 'bg-slate-100 text-slate-800' };
                                            startWorkout(workoutPayload, 'list');
                                        }}
                                        className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex justify-between items-center active:scale-95 transition-transform cursor-pointer"
                                    >
                                        <div>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                                            </div>
                                            <div className="text-xs text-slate-400 flex items-center">
                                                {filter === 'program' ? (
                                                    <>
                                                        <Clock size={10} className="mr-1" /> {item.duration} • {item.intensity}
                                                    </>
                                                ) : (
                                                    item.equipment
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-full">
                                            <Play size={16} className="text-slate-400" fill="currentColor" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const MechanicsModal = ({ onClose }) => (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800 flex items-center"><Brain className="mr-2 text-indigo-500" size={20} /> Как это работает?</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <section>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center"><Star size={16} className="text-yellow-500 mr-2" /> Уровень и Опыт (XP)</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Вы получаете баллы опыта (XP) за каждую тренировку (+100), заполнение дневника (+20) и открытие достижений (+50). Набирая XP, вы повышаете свой уровень подготовки.
                    </p>
                </section>
                <section>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center"><Activity size={16} className="text-indigo-500 mr-2" /> Характеристики</h4>
                    <ul className="text-sm text-slate-500 space-y-3">
                        <li className="flex items-start">
                            <span className="bg-rose-100 text-rose-600 p-1 rounded mr-2 mt-0.5"><Dumbbell size={12} /></span>
                            <div><span className="font-bold text-slate-700 block">Сила</span>Растет от выполнения силовых упражнений.</div>
                        </li>
                        <li className="flex items-start">
                            <span className="bg-teal-100 text-teal-600 p-1 rounded mr-2 mt-0.5"><RotateCcw size={12} /></span>
                            <div><span className="font-bold text-slate-700 block">Мобильность</span>Повышается от МФР и растяжки.</div>
                        </li>
                        <li className="flex items-start">
                            <span className="bg-amber-100 text-amber-600 p-1 rounded mr-2 mt-0.5"><Battery size={12} /></span>
                            <div><span className="font-bold text-slate-700 block">Активность</span>Общий объем выполненных тренировок.</div>
                        </li>
                        <li className="flex items-start">
                            <span className="bg-blue-100 text-blue-600 p-1 rounded mr-2 mt-0.5"><ClipboardList size={12} /></span>
                            <div><span className="font-bold text-slate-700 block">Дисциплина</span>Регулярность ведения дневника.</div>
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    </div>
);

const AchievementsModal = ({ onClose, userAchievements }) => {
    const [selected, setSelected] = useState(null);
    const sortedMeta = [...ACHIEVEMENTS_META].sort((a, b) => {
        const aUnlocked = userAchievements.some(u => u.id === a.id);
        const bUnlocked = userAchievements.some(u => u.id === b.id);
        return bUnlocked - aUnlocked;
    });

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl h-[85vh] flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center"><Trophy className="mr-2 text-yellow-500" size={20} /> Достижения</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    {selected ? (
                        <div className="flex flex-col items-center text-center p-6 animate-in zoom-in-95 bg-white rounded-xl shadow-sm">
                            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 ${selected.unlocked ? 'bg-yellow-100 border-4 border-yellow-200' : 'bg-slate-100 grayscale opacity-50'}`}>
                                {selected.meta.icon}
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">{selected.meta.title}</h3>
                            <p className="text-slate-500 mb-6">{selected.meta.desc}</p>
                            {selected.unlocked ? (
                                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center"><CheckCircle size={16} className="mr-2" /> Получено: {new Date(selected.unlocked.unlockedAt).toLocaleDateString()}</div>
                            ) : (
                                <div className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center"><Lock size={16} className="mr-2" /> Пока закрыто</div>
                            )}
                            <button onClick={() => setSelected(null)} className="mt-8 text-teal-600 text-sm font-medium hover:underline">Вернуться к списку</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-3">
                            {sortedMeta.map(ach => {
                                const unlocked = userAchievements.find(ua => ua.id === ach.id);
                                return (
                                    <div key={ach.id} onClick={() => setSelected({ meta: ach, unlocked })} className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1 border cursor-pointer transition-all active:scale-95 ${unlocked ? 'bg-white border-yellow-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-60 grayscale'}`}>
                                        <span className="text-2xl mb-1">{ach.icon}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LIMITATIONS_NONE = 'Нет жалоб';
const LIMITATIONS_OTHER = 'Другое';
const LIMITATIONS_OPTIONS = [
    'Болит спина',
    'Болит шея',
    'Боли в коленях',
    'Тяжесть в ногах',
    'Головная боль',
    'Давление',
    'Месячные',
    LIMITATIONS_OTHER,
    LIMITATIONS_NONE
];

const ScaleQuestion = ({ label, value, onChange, secondary, anchors, presets, onSkip }) => {
    return (
        <div className={`space-y-2 ${secondary ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            <div className="flex items-baseline justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase">{label}</label>
                <span className="text-xs text-slate-400">{value !== null ? `${value} / 10` : 'Не выбрано'}</span>
            </div>
            <div className="text-sm font-semibold text-slate-800">{secondary ? 'Дополнительный вопрос' : 'Оцените ваше состояние'}</div>
            <div className="text-xs text-slate-500">
                Это поможет нам точнее подобрать нагрузку на сегодня.
            </div>
            <input
                type="range"
                min="0"
                max="10"
                value={value ?? 5}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg accent-teal-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                <span>{anchors.low}</span>
                <span>5 Средне</span>
                <span>{anchors.high}</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
                {presets.map((preset) => (
                    <button type="button" key={preset} onClick={() => onChange(preset)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200">
                        {preset}
                    </button>
                ))}
                <button type="button" onClick={() => { onChange(null); if (onSkip) onSkip(); }} className="px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">
                    Пропустить
                </button>
            </div>
        </div>
    );
};

const LimitationsQuestion = ({ value, otherValue, onChange, onOtherChange, onSkip }) => {
    const toggleOption = (option) => {
        if (option === LIMITATIONS_NONE) {
            if (value.includes(LIMITATIONS_NONE)) {
                onChange([]);
            } else {
                onChange([LIMITATIONS_NONE]);
            }
            return;
        }

        const next = value.includes(option)
            ? value.filter((item) => item !== option)
            : [...value.filter((item) => item !== LIMITATIONS_NONE), option];

        if (!next.includes(LIMITATIONS_OTHER)) {
            onOtherChange('');
        }
        onChange(next);
    };

    const handleSkip = () => {
        onChange([]);
        onOtherChange('');
        if (onSkip) onSkip();
    };

    return (
        <div className="space-y-2" data-testid="limitations">
            <div className="text-sm font-semibold text-slate-800">Есть ли жалобы на самочувствие сегодня?</div>
            <div className="text-xs text-slate-500">Выделите все пункты, чтобы система учитывала ограничения.</div>
            <div className="flex flex-wrap gap-2">
                {LIMITATIONS_OPTIONS.map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => toggleOption(option)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border ${value.includes(option) ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                    >
                        {option}
                    </button>
                ))}
            </div>
            {value.includes(LIMITATIONS_OTHER) && (
                <input
                    type="text"
                    value={otherValue}
                    onChange={(e) => onOtherChange(e.target.value)}
                    className="w-full mt-2 p-2 rounded-lg border border-slate-200 text-sm"
                    placeholder="Опишите подробнее"
                />
            )}
            <button type="button" onClick={handleSkip} className="text-xs text-slate-500 underline">
                Пропустить
            </button>
        </div>
    );
};

const getReadinessCategory = (readiness) => {
    if (readiness === null) return { key: 'none', label: 'Не указано', advice: 'Заполните опросник для получения рекомендаций.' };
    const r = Number(readiness);
    if (r >= 8) {
        return { key: 'high', label: 'Отличная', advice: 'Тело готово к любым нагрузкам! Можно переходить к силовым.' };
    }
    if (r >= 5) {
        return { key: 'moderate', label: 'Хорошая', advice: 'Хорошее самочувствие. Оптимально для поддержания формы.' };
    }
    if (r >= 3) {
        return { key: 'low', label: 'Снижена', advice: 'Начните с легкого МФР и следите за болевыми ощущениями.' };
    }
    return { key: 'critical', label: 'Низкая', advice: 'Лучше сделать акцент на расслаблении и легкой растяжке.' };
};

const ReadinessSurveyModal = ({ onClose, onSave, onComplete, context, dailyPrefill }) => {
    const [readiness, setReadiness] = useState(null);
    const [fatigue, setFatigue] = useState(null);
    const [sleep, setSleep] = useState(dailyPrefill?.sleep ?? null);
    const [stress, setStress] = useState(dailyPrefill?.stress ?? null);
    const [rpe, setRpe] = useState(null);
    const [postFatigue, setPostFatigue] = useState(null);
    const [limitations, setLimitations] = useState([]);
    const [limitationsOther, setLimitationsOther] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);
    const [pendingSave, setPendingSave] = useState(null);
    const [useDailyPrefill, setUseDailyPrefill] = useState(Boolean(dailyPrefill));
    const [prefillDecision, setPrefillDecision] = useState(dailyPrefill ? 'pending' : 'none');

    useEffect(() => {
        trackEvent('readiness_survey_start', { context });
    }, [context]);

    useEffect(() => {
        if (dailyPrefill && context === 'pre') {
            trackEvent('daily_prefill_shown', { context });
        }
    }, [dailyPrefill, context]);

    useEffect(() => {
        if (showDetails) {
            trackEvent('questionnaire_details_opened', { context });
        }
    }, [showDetails, context]);

    const handlePrefillConfirm = () => {
        setPrefillDecision('confirmed');
        setUseDailyPrefill(true);
        trackEvent('daily_prefill_confirmed', { context });
    };

    const handlePrefillEdit = () => {
        setPrefillDecision('edit');
        setUseDailyPrefill(false);
        setShowDetails(true);
        trackEvent('daily_prefill_edited', { context });
    };

    const buildValues = () => ({
        readiness,
        fatigue,
        sleep,
        stress,
        limitations,
        limitationsOther: limitationsOther.trim() ? limitationsOther.trim() : null,
        rpe,
        postFatigue
    });

    const coreSkipped = (values) => {
        const hasLimitations = values.limitations.length > 0 || values.limitationsOther;
        if (context === 'daily') {
            return values.readiness === null && values.sleep === null && values.stress === null && !hasLimitations;
        }
        if (context === 'pre') {
            return values.readiness === null && !hasLimitations;
        }
        return values.rpe === null && values.postFatigue === null && !hasLimitations;
    };

    const getCompletionLevel = (values) => {
        const detailsValues = [];
        if (context === 'daily') {
            detailsValues.push(values.fatigue);
        }
        if (context === 'pre') {
            detailsValues.push(values.fatigue);
            if (!useDailyPrefill) {
                detailsValues.push(values.sleep, values.stress);
            }
        }
        return detailsValues.some((val) => val !== null && val !== undefined) ? 'full' : 'core';
    };

    const commitSave = (values, completionLevel) => {
        onSave({ context, values, completionLevel });
        trackEvent('readiness_survey_complete', { context, completionLevel });
        setShowFeedback(true);
        const category = getReadinessCategory(values.readiness);
        trackEvent('readiness_feedback_viewed', { context, category: category.key });
    };

    const handleSave = () => {
        const values = buildValues();
        const completionLevel = getCompletionLevel(values);
        if (coreSkipped(values)) {
            setPendingSave({ values, completionLevel });
            setShowSkipConfirm(true);
            return;
        }
        commitSave(values, completionLevel);
    };

    const handleSkipConfirm = () => {
        if (pendingSave) {
            commitSave(pendingSave.values, pendingSave.completionLevel);
            setPendingSave(null);
            setShowSkipConfirm(false);
        }
    };

    const category = getReadinessCategory(readiness);
    const showDetailsToggle = context === 'daily' || context === 'pre';
    const showSleepStressDetails = context === 'pre' && !useDailyPrefill;
    const canClose = context === 'daily';

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl h-[85vh] overflow-y-auto relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">
                        {context === 'pre' ? 'Перед тренировкой' : context === 'post' ? 'После тренировки' : 'Самочувствие дня'}
                    </h3>
                    {canClose && <button onClick={onClose}><X size={20} /></button>}
                </div>

                {showFeedback ? (
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="bg-emerald-100 text-emerald-700 rounded-full p-4"><CheckCircle size={28} /></div>
                        <div className="text-sm font-semibold text-slate-700">Готовность: {category.label}</div>
                        <div className="text-xs text-slate-500">{category.advice}</div>
                        <button onClick={() => { if (onComplete) onComplete(context); onClose(); }} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl">
                            {context === 'pre' ? 'Начать тренировку' : 'Завершить'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {(context === 'daily' || context === 'pre') && (
                            <ScaleQuestion
                                label="Готовность"
                                value={readiness}
                                onChange={setReadiness}
                                anchors={{ low: '0 Точно отдых', high: '10 К рекордам' }}
                                presets={[0, 5, 10]}
                                onSkip={() => trackEvent('question_skipped', { context, question: 'readiness' })}
                            />
                        )}

                        {context === 'daily' && (
                            <ScaleQuestion
                                label="Сон"
                                value={sleep}
                                onChange={setSleep}
                                anchors={{ low: '0 Тяжело', high: '10 Выспался' }}
                                presets={[0, 5, 10]}
                                onSkip={() => trackEvent('question_skipped', { context, question: 'sleep' })}
                            />
                        )}

                        {context === 'daily' && (
                            <ScaleQuestion
                                label="Стресс"
                                value={stress}
                                onChange={setStress}
                                anchors={{ low: '0 Спокоен', high: '10 Очень высокий' }}
                                presets={[0, 5, 10]}
                                onSkip={() => trackEvent('question_skipped', { context, question: 'stress' })}
                            />
                        )}

                        {(context === 'daily' || context === 'pre' || context === 'post') && (
                            <LimitationsQuestion
                                value={limitations}
                                otherValue={limitationsOther}
                                onChange={setLimitations}
                                onOtherChange={setLimitationsOther}
                                onSkip={() => trackEvent('question_skipped', { context, question: 'limitations' })}
                            />
                        )}

                        {context === 'pre' && dailyPrefill && useDailyPrefill && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold">Сон/Стресс</span>
                                    <span className="text-[10px] uppercase text-slate-400">Подставлено из daily</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Сон: {sleep ?? 'Не указано'}</span>
                                    <span>Стресс: {stress ?? 'Не указано'}</span>
                                </div>
                                {prefillDecision === 'pending' && (
                                    <div className="mt-3 flex items-center justify-between font-medium">
                                        <span>Актуально сегодня?</span>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handlePrefillConfirm} className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">Да</button>
                                            <button type="button" onClick={handlePrefillEdit} className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600">Изменить</button>
                                        </div>
                                    </div>
                                )}
                                {prefillDecision !== 'pending' && (
                                    <button type="button" onClick={handlePrefillEdit} className="mt-2 text-xs text-teal-600 underline">Изменить</button>
                                )}
                            </div>
                        )}

                        {showDetailsToggle && (
                            <div className="space-y-3">
                                <button type="button" onClick={() => setShowDetails((prev) => !prev)} className="w-full flex items-center justify-between text-sm font-semibold text-teal-600">
                                    Подробнее
                                    <ChevronRight size={16} className={`transition-transform ${showDetails ? 'rotate-90' : ''}`} />
                                </button>
                                <div className="text-xs text-slate-500">Еще ~20 сек, чтобы точнее настроить программу.</div>
                            </div>
                        )}

                        {showDetails && (context === 'daily' || context === 'pre') && (
                            <ScaleQuestion
                                label="Усталость"
                                value={fatigue}
                                onChange={setFatigue}
                                secondary={true}
                                anchors={{ low: '0 Бодр', high: '10 Вымотан' }}
                                presets={[0, 5, 10]}
                                onSkip={() => trackEvent('question_skipped', { context, question: 'fatigue' })}
                            />
                        )}

                        {showDetailsToggle && showDetails && showSleepStressDetails && (
                            <>
                                <ScaleQuestion
                                    label="Сон"
                                    value={sleep}
                                    onChange={setSleep}
                                    secondary={true}
                                    anchors={{ low: '0 Тяжело', high: '10 Выспался' }}
                                    presets={[0, 5, 10]}
                                    onSkip={() => trackEvent('question_skipped', { context, question: 'sleep' })}
                                />
                                <ScaleQuestion
                                    label="Стресс"
                                    value={stress}
                                    onChange={setStress}
                                    secondary={true}
                                    anchors={{ low: '0 Спокоен', high: '10 Очень высокий' }}
                                    presets={[0, 5, 10]}
                                    onSkip={() => trackEvent('question_skipped', { context, question: 'stress' })}
                                />
                            </>
                        )}

                        {context === 'post' && (
                            <>
                                <ScaleQuestion
                                    label="Сложность (RPE)"
                                    value={rpe}
                                    onChange={setRpe}
                                    anchors={{ low: '0 Легко', high: '10 Предел' }}
                                    presets={[0, 5, 10]}
                                    onSkip={() => trackEvent('question_skipped', { context, question: 'rpe' })}
                                />
                                <ScaleQuestion
                                    label="Усталость после"
                                    value={postFatigue}
                                    onChange={setPostFatigue}
                                    anchors={{ low: '0 Бодр', high: '10 Вымотан' }}
                                    presets={[0, 5, 10]}
                                    onSkip={() => trackEvent('question_skipped', { context, question: 'postFatigue' })}
                                />
                            </>
                        )}
                    </div>
                )}

                {!showFeedback && (
                    <button onClick={handleSave} className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl flex justify-center items-center mt-6 active:scale-95 transition-transform">
                        Завершить <CheckCircle size={18} className="ml-2" />
                    </button>
                )}
            </div>

            {showSkipConfirm && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in">
                    <AlertTriangle size={48} className="text-amber-500 mb-4" />
                    <h4 className="font-bold text-lg mb-2">Пропустить опрос?</h4>
                    <p className="text-sm text-slate-500 mb-6">Ваши данные помогают нам точнее подбирать программу.</p>
                    <div className="space-y-2 w-full">
                        <button onClick={() => setShowSkipConfirm(false)} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl">Вернуться к опросу</button>
                        <button onClick={handleSkipConfirm} className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm italic underline">Все равно пропустить</button>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- VIEWS ---

const HomeView = ({ startWorkout, history, painLogs, readinessLogs, onLogReadiness, achievements }) => {
    const currentHour = new Date().getHours();
    const isMorning = currentHour < 11;
    const isLateEvening = currentHour >= 21;

    const recommendation = useMemo(() => {
        const sortedReadiness = [...readinessLogs].sort((a, b) => new Date((b.createdAt || b.date)) - new Date((a.createdAt || a.date)));
        const lastReadiness = sortedReadiness.find(l => l.context === 'daily' || l.context === 'pre');
        const readinessValue = lastReadiness?.values?.readiness;

        if (typeof readinessValue === 'number') {
            if (readinessValue <= 3) {
                return { title: '?????? ????????', reason: `?????????? ??????? ?????? (${readinessValue}).`, workouts: WORKOUTS.filter(w => w.type === 'relax') };
            }
            if (readinessValue >= 7) {
                return { title: '????? ?????????', reason: `?????????? ??????? (${readinessValue}).`, workouts: WORKOUTS.filter(w => w.type === 'strength') };
            }
        }

        const sortedLogs = [...painLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastLegacyLog = sortedLogs.find(l => l.context === 'daily' || l.context === 'pre');

        if (!lastReadiness && !lastLegacyLog) {
            return { title: '? ???? ???????', reason: '???????? ?? ???????? ???????, ????? ????????? ????????.', workouts: [WORKOUTS.find(w => w.id === 'morning_mobility')] };
        }

        if (isLateEvening) return { title: '?????? ???? ? ??????', reason: '????????? ???????? ??????? ??????????????.', workouts: WORKOUTS.filter(w => w.type === 'relax') };
        if (isMorning) return { title: '?????? ????', reason: '???????? ???????? ?????????? ? ???.', workouts: [WORKOUTS.find(w => w.id === 'morning_mobility')] };
        if (lastLegacyLog && lastLegacyLog.energy < 4) return { title: '?????? ????????', reason: '??????? ????? ?????? ????.', workouts: WORKOUTS.filter(w => w.type === 'mobility') };
        return { title: '?????? ? ?????????', reason: '????? ???????? ???? ? ???????????.', workouts: WORKOUTS.filter(w => w.type === 'strength') };
    }, [readinessLogs, painLogs, isMorning, isLateEvening]);

    const hasDailyLog = useMemo(() => {
        const today = new Date().toDateString();
        const readinessLogged = readinessLogs.some(l => new Date(l.createdAt || l.date).toDateString() === today && l.context === 'daily');
        if (readinessLogged) return true;
        return painLogs.some(l => new Date(l.date).toDateString() === today && l.context === 'daily');
    }, [readinessLogs, painLogs]);

    const recentAchievements = useMemo(() => {
        return [...achievements].sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt)).slice(0, 5);
    }, [achievements]);

    return (
        <div className="p-6 space-y-6 pb-24 animate-in fade-in duration-500">
            {recentAchievements.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase">Недавние награды</h4>
                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                        {recentAchievements.map(ua => {
                            const meta = ACHIEVEMENTS_META.find(m => m.id === ua.id);
                            return meta ? (
                                <div key={ua.id} className="bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg flex items-center min-w-[150px] shadow-sm">
                                    <span className="text-2xl mr-3">{meta.icon}</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-yellow-800 font-bold leading-tight line-clamp-1">{meta.title}</span>
                                        <span className="text-[9px] text-yellow-600">{new Date(ua.unlockedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                </div>
                            ) : null;
                        })}
                    </div>
                </div>
            )}
            <div onClick={() => !hasDailyLog && onLogReadiness('daily')} className={`rounded-2xl p-5 shadow-sm border transition-all ${hasDailyLog ? 'bg-emerald-50 border-emerald-100' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'}`}>
                <div className="flex justify-between items-center">
                    <div>
                        <div className="font-bold text-sm mb-1">{hasDailyLog ? 'Чек-ап прошел' : 'Ежедневный чек-ап'}</div>
                        <div className="text-lg font-bold">{hasDailyLog ? 'Хорошего дня!' : 'Как самочувствие?'}</div>
                    </div>
                    <div className="p-3 rounded-full bg-white/20 text-white"><Activity size={24} /></div>
                </div>
            </div>
            <div>
                <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-800">{recommendation.title}</h3>
                    {isMorning && <Sun size={16} className="text-amber-500" />}
                    {isLateEvening && <Moon size={16} className="text-indigo-400" />}
                </div>
                <p className="text-xs text-slate-500 mb-4">{recommendation.reason}</p>
                <div className="space-y-3">
                    {recommendation.workouts.slice(0, 3).map(workout => (
                        <div key={workout.id} onClick={() => startWorkout(workout, 'home')} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                            <div className="flex items-center space-x-4">
                                <div className={`${workout.color.split(' ')[0]} p-3 rounded-lg ${workout.color.split(' ')[1]}`}>
                                    {workout.type === 'strength' ? <Dumbbell size={24} /> : <Activity size={24} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{workout.title}</h4>
                                    <p className="text-xs text-slate-500">{workout.duration} • {workout.subtitle}</p>
                                </div>
                            </div>
                            <ChevronRight className="text-slate-300" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const PhysicalStats = ({ stats, onHelp }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-800 flex items-center"><User size={18} className="mr-2 text-indigo-600" /> Физическая форма</h4>
            <button onClick={onHelp} className="text-slate-300 hover:text-indigo-500 transition-colors"><HelpCircle size={18} /></button>
        </div>
        <div className="space-y-4">
            {[
                { label: 'Сила', val: stats.strength, icon: <Dumbbell size={14} />, color: 'bg-rose-500', max: 50 },
                { label: 'Мобильность', val: stats.agility, icon: <RotateCcw size={14} />, color: 'bg-teal-500', max: 30 },
                { label: 'Активность', val: stats.endurance, icon: <Activity size={14} />, color: 'bg-amber-500', max: 100 },
                { label: 'Дисциплина', val: stats.wisdom, icon: <ClipboardList size={14} />, color: 'bg-blue-500', max: 50 },
            ].map(s => (
                <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1 font-bold text-slate-600">
                        <span className="flex items-center gap-1">{s.icon} {s.label}</span>
                        <span>{Math.floor(s.val)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.color}`} style={{ width: `${Math.min(100, (s.val / s.max) * 100)}%` }}></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const StatsView = ({ history, painLogs, resetAll, achievements, openAchievements, weights, openMechanics }) => {
    const [showConfirmReset, setShowConfirmReset] = useState(false);
    const stats = useMemo(() => {
        const strengthWorkouts = history.filter(h => WORKOUTS.find(w => w.id === h.workoutId)?.type === 'strength' || h.workoutId.includes('single_')).length;
        const relaxWorkouts = history.filter(h => WORKOUTS.find(w => w.id === h.workoutId)?.type === 'relax' || h.workoutId.includes('single_')).length;
        const totalWeight = Object.values(weights).reduce((a, b) => a + Number(b), 0);
        return { strength: (totalWeight / 5) + (strengthWorkouts * 2), agility: relaxWorkouts * 3, endurance: history.length, wisdom: painLogs.length * 2 };
    }, [history, painLogs, weights]);

    const maxWeights = useMemo(() => Object.entries(weights).map(([id, w]) => ({ title: EXERCISES[id]?.title, weight: w })).sort((a, b) => b.weight - a.weight), [weights]);

    const triggerStats = useMemo(() => {
        const stats = {};
        painLogs.forEach(log => {
            if (log.triggers) {
                log.triggers.forEach(t => {
                    if (!stats[t]) stats[t] = { count: 0, totalPain: 0 };
                    stats[t].count++;
                    stats[t].totalPain += log.level;
                });
            }
        });
        return Object.entries(stats).map(([k, v]) => ({ name: k, avg: (v.totalPain / v.count).toFixed(1) })).sort((a, b) => b.avg - a.avg);
    }, [painLogs]);

    return (
        <div className="p-6 pb-24 space-y-6 overflow-y-auto h-screen relative">
            <h2 className="text-xl font-bold text-slate-800">Ваш профиль</h2>
            <PhysicalStats stats={stats} onHelp={openMechanics} />
            <div onClick={openAchievements} className="bg-gradient-to-r from-yellow-400 to-orange-500 p-4 rounded-xl text-white shadow-lg cursor-pointer active:scale-95 transition-transform mb-6">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center"><Trophy className="mr-2" /> <span className="font-bold">Достижения</span></div>
                    <ChevronRight size={20} className="opacity-70" />
                </div>
                <div className="flex items-baseline space-x-2"><span className="text-3xl font-bold">{achievements.length}</span><span className="text-sm opacity-80">из {ACHIEVEMENTS_META.length} открыто</span></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center"><Shield size={18} className="mr-2 text-slate-500" /> Личные рекорды</h4>
                {maxWeights.length > 0 ? (
                    <div className="space-y-3">{maxWeights.map(item => (<div key={item.title} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0"><span className="text-slate-600">{item.title}</span><span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{item.weight} кг</span></div>))}</div>
                ) : <p className="text-xs text-slate-400">Пока нет записей о весах.</p>}
            </div>
            {triggerStats.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center"><Zap size={14} className="mr-2 text-amber-500" /> Что влияет на боль</h4>
                    <div className="space-y-2">
                        {triggerStats.slice(0, 3).map((stat, i) => (
                            <div key={i} className="flex justify-between items-center text-xs">
                                <span className="text-slate-600 font-medium">{stat.name}</span>
                                <span className={`font-bold px-2 py-1 rounded ${Number(stat.avg) > 5 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>ср. боль: {stat.avg}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <button onClick={() => setShowConfirmReset(true)} className="w-full mt-8 py-3 text-red-400 text-sm border border-red-100 rounded-xl flex items-center justify-center"><RotateCcw size={16} className="mr-2" /> Сбросить прогресс</button>
            {showConfirmReset && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6 rounded-2xl">
                    <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-xs text-center">
                        <h3 className="font-bold text-slate-800 text-lg mb-4">Сброс?</h3>
                        <div className="flex space-x-3">
                            <button onClick={() => setShowConfirmReset(false)} className="flex-1 py-2 rounded-lg bg-slate-100">Отмена</button>
                            <button onClick={() => { resetAll(); setShowConfirmReset(false); }} className="flex-1 py-2 rounded-lg bg-red-500 text-white">Сброс</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const WorkoutPlayer = ({ workout, onClose, onComplete, onLogPreReadiness, preSurveyDone, savedWeights, onSaveWeight }) => {
    const [step, setStep] = useState('intro');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(true);
    const [currentWeight, setCurrentWeight] = useState('');
    const [showAllExercises, setShowAllExercises] = useState(false);

    // Strength Specific State
    const [configSets, setConfigSets] = useState('3');
    const [configReps, setConfigReps] = useState('10');
    const [configRest, setConfigRest] = useState('60');
    const [currentSet, setCurrentSet] = useState(1);
    const [isResting, setIsResting] = useState(false);
    const [restTimeLeft, setRestTimeLeft] = useState(0);
    const [isAutoAdvance, setIsAutoAdvance] = useState(() => {
        const saved = localStorage.getItem('mfr_auto_advance');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [sessionState, setSessionState] = useState({});
    const currentExId = workout.exercises[currentIndex];
    const currentEx = EXERCISES[currentExId];
    const totalExercises = workout.exercises.length;
    const isSingleMode = workout.exercises.length === 1;

    useEffect(() => {
        if (currentEx) {
            setTimeLeft(currentEx.duration || 0);
            if (currentEx.isStrength) {
                setCurrentWeight(savedWeights[currentExId] || '');
            }
        }
    }, [currentExId, savedWeights, currentEx]);

    useEffect(() => {
        localStorage.setItem('mfr_auto_advance', JSON.stringify(isAutoAdvance));
    }, [isAutoAdvance]);

    // Main Timer Effect
    useEffect(() => {
        let interval = null;
        if (isActive && !isPaused && !isResting && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((t) => {
                    if (t <= 4 && t > 1) playSound('tick');
                    if (t === 1) playSound('finish');
                    return t - 1;
                });
            }, 1000);
        } else if (timeLeft === 0 && isActive && !isPaused && !isResting && !currentEx.isStrength) {
            setIsActive(false);
            setIsPaused(true);
        }
        return () => clearInterval(interval);
    }, [isActive, isPaused, isResting, timeLeft, currentEx]);

    // Rest Timer Effect
    useEffect(() => {
        let interval = null;
        if (isResting && !isPaused && restTimeLeft > 0) {
            interval = setInterval(() => {
                setRestTimeLeft((t) => {
                    if (t <= 4 && t > 1) playSound('tick');
                    if (t === 1) playSound('finish');
                    return t - 1;
                });
            }, 1000);
        } else if (isResting && restTimeLeft === 0 && !isPaused) {
            if (isAutoAdvance) {
                startNextSet();
            }
        }
        return () => clearInterval(interval);
    }, [isResting, isPaused, restTimeLeft, isAutoAdvance]);

    const startStrengthWorkout = () => {
        trackEvent('strength_config_save', {
            exerciseId: currentExId,
            weight: currentWeight,
            sets: configSets,
            reps: configReps
        });
        setCurrentSet(1);
        setIsResting(false);
        setStep('playing');
        setIsPaused(false);
        setIsActive(true);
    };

    const completeSet = () => {
        if (currentSet < parseInt(configSets)) {
            const rest = parseInt(configRest);
            if (rest > 0) {
                setIsResting(true);
                setRestTimeLeft(rest);
            } else {
                startNextSet();
            }
        } else {
            nextExercise();
        }
    };

    const startNextSet = () => {
        setCurrentSet(s => s + 1);
        setIsResting(false);
        setRestTimeLeft(0);
    };

    const skipRest = () => {
        startNextSet();
    };

    const addRestTime = () => {
        setRestTimeLeft(t => t + 30);
    };

    const nextExercise = () => {
        if (currentEx.isStrength && currentWeight) onSaveWeight(currentExId, currentWeight);

        // Capture results for current exercise
        const results = currentEx.isStrength ? {
            exerciseType: 'strength',
            strength: {
                sets: parseInt(configSets),
                reps: parseInt(configReps),
                weight: parseFloat(currentWeight || 0),
                rest: parseInt(configRest)
            }
        } : { exerciseType: 'time' };

        setSessionState(prev => ({ ...prev, [currentExId]: results }));

        if (currentIndex < totalExercises - 1) {
            const nextIdx = currentIndex + 1;
            const nextEx = EXERCISES[workout.exercises[nextIdx]];
            setCurrentIndex(nextIdx);
            setCurrentSet(1);
            setIsResting(false);

            if (nextEx.isStrength) {
                setStep('strength_config');
            } else {
                setStep('playing');
                setTimeLeft(nextEx.duration);
                setIsPaused(false);
                setIsActive(true);
            }
        } else {
            setStep('finished');
        }
    };

    const prevExercise = () => {
        if (currentIndex > 0) {
            const prevIdx = currentIndex - 1;
            const prevEx = EXERCISES[workout.exercises[prevIdx]];
            setCurrentIndex(prevIdx);
            setCurrentSet(1);
            setIsResting(false);

            if (prevEx.isStrength) {
                setStep('strength_config');
            } else {
                setStep('playing');
                setTimeLeft(prevEx.duration);
                setIsPaused(true);
                setIsActive(false);
            }
        }
    };

    const restartCurrent = () => {
        if (currentEx.isStrength) {
            setStep('strength_config');
        } else {
            setTimeLeft(currentEx.duration);
            setIsActive(true);
            setIsPaused(false);
            setStep('playing');
        }
    };

    if (step === 'intro') {
        const displayExercises = showAllExercises ? workout.exercises : workout.exercises.slice(0, 3);
        const hasMore = workout.exercises.length > 3;

        const inventory = [...new Set(workout.exercises.map(id => EXERCISES[id]?.equipment))].filter(Boolean).join(', ');

        return (
            <div className="fixed inset-0 z-40 bg-white flex flex-col p-6 animate-in slide-in-from-bottom overflow-y-auto">
                <button onClick={onClose} className="absolute top-6 left-6 text-slate-400 p-2"><X /></button>

                <div className="mt-12 flex flex-col items-center">
                    <div className={`p-6 rounded-full ${workout.color?.split(' ')[0] || 'bg-slate-100'} mb-6`}>
                        {workout.type === 'strength' ? <Dumbbell size={48} className={workout.color?.split(' ')[1]} /> : <Activity size={48} className={workout.color?.split(' ')[1]} />}
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-slate-800">{workout.title}</h2>
                    <p className="text-slate-500 mb-6 text-sm">{workout.subtitle || (isSingleMode ? 'Одиночное упражнение' : 'Программа тренировок')}</p>

                    <div className="w-full space-y-6 text-left max-w-sm">
                        {/* Цель / Направленность */}
                        {workout.targets && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Цель и фокус</h3>
                                <div className="flex flex-wrap gap-2">
                                    {workout.targets.map(t => (
                                        <span key={t} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Состав */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Состав тренировки</h3>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                {displayExercises.map((id, idx) => (
                                    <div key={`${id}-${idx}`} data-testid="start-screen-exercise-item" className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700">{EXERCISES[id]?.title}</span>
                                        <span className="text-xs text-slate-400">{EXERCISES[id]?.isStrength ? '' : `${EXERCISES[id]?.duration}с`}</span>
                                    </div>
                                ))}
                                {hasMore && !showAllExercises && (
                                    <button
                                        data-testid="start-screen-more-button"
                                        onClick={() => setShowAllExercises(true)}
                                        className="w-full py-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors border-t border-slate-200 mt-2"
                                    >
                                        Еще {workout.exercises.length - 3} упражнений
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Длительность */}
                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                            <div className="flex items-center text-slate-600">
                                <Clock size={16} className="mr-2" />
                                <span className="text-sm font-medium">Общая длительность</span>
                            </div>
                            <span className="text-sm font-bold text-slate-800">{workout.duration || `${workout.exercises.length * 2} мин`}</span>
                        </div>

                        {/* Инвентарь */}
                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                            <div className="flex items-center text-slate-600">
                                <Dumbbell size={16} className="mr-2" />
                                <span className="text-sm font-medium">Инвентарь</span>
                            </div>
                            <span className="text-sm font-bold text-slate-800 truncate ml-4">{inventory || 'Без инвентаря'}</span>
                        </div>
                    </div>

                    <button
                        data-testid="start-screen-start"
                        onClick={() => {
                            trackEvent('workout_start', { workoutId: workout.id, source: workout.source });
                            if (preSurveyDone) {
                                if (currentEx.isStrength) {
                                    setStep('strength_config');
                                } else {
                                    setStep('playing');
                                    setIsPaused(false);
                                    setIsActive(true);
                                }
                            } else {
                                onLogPreReadiness();
                            }
                        }}
                        className="w-full max-w-sm bg-teal-600 text-white font-bold py-4 rounded-2xl mt-10 shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95"
                    >
                        Начать тренировку
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'strength_config') {
        return (
            <div className="fixed inset-0 z-40 bg-white flex flex-col p-6 animate-in slide-in-from-bottom overflow-y-auto">
                <button onClick={onClose} className="absolute top-6 left-6 text-slate-400 p-2"><X /></button>
                <div className="mt-12 flex flex-col items-center w-full max-w-sm mx-auto">
                    <div className="bg-rose-50 p-4 rounded-2xl mb-6">
                        <Dumbbell size={32} className="text-rose-600" />
                    </div>
                    <h2 className="text-xl font-bold mb-1 text-center">{currentEx.title}</h2>
                    <p className="text-sm text-slate-500 mb-8 text-center">{currentEx.equipment}</p>

                    <div className="w-full space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Вес (кг)</label>
                                <input
                                    data-testid="strength-input-weight"
                                    type="number"
                                    value={currentWeight}
                                    onChange={(e) => setCurrentWeight(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold text-xl focus:border-rose-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Подходы</label>
                                <input
                                    data-testid="strength-input-sets"
                                    type="number"
                                    value={configSets}
                                    onChange={(e) => setConfigSets(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold text-xl focus:border-rose-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Повторения</label>
                                <input
                                    data-testid="strength-input-reps"
                                    type="number"
                                    value={configReps}
                                    onChange={(e) => setConfigReps(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold text-xl focus:border-rose-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Отдых (сек)</label>
                                <input
                                    data-testid="strength-input-rest"
                                    type="number"
                                    value={configRest}
                                    onChange={(e) => setConfigRest(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-bold text-xl focus:border-rose-500 focus:outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        data-testid="strength-start"
                        onClick={startStrengthWorkout}
                        className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl mt-10 shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                    >
                        Начать упражнение
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'finished') {
        return (
            <div className="fixed inset-0 z-40 bg-white flex flex-col p-6 justify-center items-center text-center">
                <div className="bg-emerald-100 text-emerald-600 p-6 rounded-full mb-6"><CheckCircle size={48} /></div>
                <h2 className="text-2xl font-bold mb-8">Отлично!</h2>
                <div className="space-y-3 w-full max-w-xs">
                    {isSingleMode && <button onClick={restartCurrent} className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center"><Repeat size={18} className="mr-2" /> Повторить упражнение</button>}
                    <button onClick={() => {
                        const completedList = workout.exercises.map(exId => ({
                            exerciseId: exId,
                            ...(sessionState[exId] || {})
                        }));
                        onComplete(workout.id, completedList);
                    }} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl">Завершить</button>
                </div>
            </div>
        );
    }

    const progressPercent = ((currentIndex) / totalExercises) * 100;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
                <button onClick={onClose} className="text-slate-500 text-sm p-2"><X size={18} /></button>
                <div className="font-bold text-sm truncate max-w-[200px]">{workout.title}</div>
                <div className="text-slate-500 text-sm">{currentIndex + 1}/{totalExercises}</div>
            </div>
            <div className="w-full bg-slate-100 h-1"><div className="bg-indigo-500 h-1 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div></div>

            <div className="flex-1 flex flex-col items-center p-6 text-center overflow-y-auto w-full max-w-sm mx-auto">
                {isResting ? (
                    <div data-testid="strength-rest" className="flex-1 flex flex-col items-center justify-center w-full">
                        <div className="bg-indigo-50 text-indigo-700 px-4 py-1 rounded-full text-xs font-bold mb-6 flex items-center">
                            <Clock size={14} className="mr-2" /> ОТДЫХ
                        </div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Следующий подход: {currentSet + 1}</h3>
                        <div className="text-8xl font-bold font-mono text-slate-800 mb-8">{restTimeLeft}</div>

                        <div className="w-full grid grid-cols-2 gap-4 mb-8">
                            <button
                                onClick={addRestTime}
                                className="py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                                <Plus size={18} className="mr-1" /> 30 сек
                            </button>
                            <button
                                data-testid="strength-rest-skip"
                                onClick={skipRest}
                                className="py-4 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-colors"
                            >
                                <SkipForward size={18} className="mr-1" /> Пропустить
                            </button>
                        </div>

                        <div className="flex items-center space-x-3 text-slate-500">
                            <div className="flex items-center cursor-pointer" onClick={() => setIsAutoAdvance(!isAutoAdvance)}>
                                <div className={`w-10 h-5 rounded-full relative transition-colors mr-3 ${isAutoAdvance ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAutoAdvance ? 'left-6' : 'left-1'}`}></div>
                                </div>
                                <span className="text-xs font-bold">Автопереход</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold mb-6">{currentEx.equipment}</div>
                        <h2 className="text-3xl font-bold mb-4 text-slate-800">{currentEx.title}</h2>

                        <div className="bg-slate-50 p-6 rounded-2xl mb-8 w-full border border-slate-100">
                            <p className="text-slate-600 leading-relaxed text-lg">{currentEx.description}</p>
                        </div>

                        {currentEx.isStrength ? (
                            <div className="w-full space-y-8">
                                <div data-testid="strength-set-indicator" className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Подход</span>
                                    <div className="text-6xl font-black text-slate-800">{currentSet}<span className="text-slate-200 text-4xl">/{configSets}</span></div>
                                    <div className="mt-2 text-sm font-bold text-indigo-600">{configReps} ПОВТОРЕНИЙ</div>
                                </div>

                                {currentWeight && (
                                    <div className="bg-rose-50 border border-rose-100 px-4 py-2 rounded-xl inline-flex items-center text-rose-700 font-bold">
                                        <Dumbbell size={16} className="mr-2" /> {currentWeight} кг
                                    </div>
                                )}

                                <button
                                    data-testid="strength-complete-set"
                                    onClick={completeSet}
                                    className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center text-lg"
                                >
                                    ПОДХОД ВЫПОЛНЕН <CheckCircle size={24} className="ml-3" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="text-7xl font-bold font-mono text-slate-800 mb-2">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
                                <div className="text-sm text-slate-400 uppercase font-bold tracking-widest">{isPaused ? 'ПАУЗА' : 'РАБОТАЕМ'}</div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {!isResting && (
                <div className="p-6 pb-8 bg-slate-50 border-t flex justify-between items-center">
                    <button
                        onClick={prevExercise}
                        disabled={currentIndex === 0}
                        className="p-3 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
                    >
                        <RotateCcw size={24} />
                    </button>

                    {!currentEx.isStrength && (
                        <button
                            onClick={() => { setIsActive(true); setIsPaused(!isPaused); }}
                            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transform active:scale-95 transition-all ${!isPaused && timeLeft > 0 ? 'bg-amber-400' : 'bg-teal-600'}`}
                        >
                            {!isPaused && timeLeft > 0 ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                        </button>
                    )}

                    <button
                        onClick={nextExercise}
                        className="p-3 text-slate-800 hover:text-slate-600 transition-colors"
                    >
                        <SkipForward size={28} />
                    </button>
                </div>
            )}
        </div>
    );
};

// --- MAIN APP ---

export default function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('user_token'));
    const [loading, setLoading] = useState(!!token);
    const [activeTab, setActiveTab] = useState('home');
    const [activeWorkout, setActiveWorkout] = useState(null);
    const [modalConfig, setModalConfig] = useState({ show: false, context: 'daily' });
    const [showAchievements, setShowAchievements] = useState(false);
    const [showMechanics, setShowMechanics] = useState(false);
    const [preSurveyDone, setPreSurveyDone] = useState(false);

    const [history, setHistory] = useState([]);
    const [painLogs, setPainLogs] = useState([]);
    const [readinessLogs, setReadinessLogs] = useState([]);
    const [weights, setWeights] = useState({});
    const [achievements, setAchievements] = useState([]);
    const [listState, setListState] = useState({ filter: 'program', selectedCategory: null, scrollTop: 0 });


    // Init Data Sync
    useEffect(() => {
        if (token) {
            // If using real backend, verify token validity here
            // For now, load data
            apiRequest('/data/sync', 'GET', null, token)
                .then(data => {
                    setHistory(data.history || []);
                    setPainLogs(data.painLogs || []);
                    setWeights(data.weights || {});
                    setAchievements(data.achievements || []);
                    setReadinessLogs(data.readinessLogs || []);
                    setUser({ email: 'user@example.com' }); // Mock user object
                })
                .catch(e => {
                    console.error(e);
                    setToken(null);
                    localStorage.removeItem('user_token');
                })
                .finally(() => setLoading(false));
        }
    }, [token]);

    // Helper to sync specific data to backend
    const syncData = async (type, payload) => {
        if (loading) return; // Prevent syncing during initial load to avoid overwriting with empty state
        try {
            if (token) await apiRequest(`/data/${type}`, 'POST', payload, token);
        } catch (e) {
            console.error("Sync failed", e);
        }
    };

    const levelData = useMemo(() => {
        const baseXP = history.length * 100 + painLogs.length * 20 + achievements.length * 50;
        const level = Math.floor(baseXP / 500) + 1;
        const xpInLevel = baseXP % 500;
        return { level, xp: xpInLevel, xpToNext: 500 };
    }, [history, painLogs, achievements]);

    const checkAchievements = (newHistory, newLogs, currentWeights) => {
        const unlockedNow = [];
        ACHIEVEMENTS_META.forEach(ach => {
            const isAlreadyUnlocked = achievements.some(a => a.id === ach.id);
            if (!isAlreadyUnlocked && checkAchievementConditions(ach.id, newHistory, newLogs, currentWeights)) {
                unlockedNow.push({ id: ach.id, unlockedAt: new Date().toISOString() });
            }
        });

        if (unlockedNow.length > 0) {
            const newSet = [...achievements, ...unlockedNow];
            setAchievements(newSet);
            playSound('levelup');
            syncData('achievements', newSet);
        }
    };

    const saveReadinessLog = ({ context, values, completionLevel }) => {
        const newLog = {
            context,
            values,
            completionLevel,
            createdAt: new Date().toISOString(),
            schemaVersion: 1
        };
        const newLogs = [...readinessLogs, newLog];
        setReadinessLogs(newLogs);
        syncData('readinessLogs', newLogs);
    };

    const handleSurveyComplete = (context) => {
        if (context === 'pre') {
            setPreSurveyDone(true);
        } else if (context === 'post') {
            setActiveWorkout(null);
            setActiveTab('stats');
        }
    };

    const handleCompleteWorkout = (wId, completedExercises = []) => {
        const timestamp = new Date().toISOString();
        let newEntries = [];

        if (completedExercises.length > 0) {
            newEntries = completedExercises.map(ex => ({
                date: timestamp,
                workoutId: wId,
                ...ex
            }));
        } else {
            newEntries = [{ date: timestamp, workoutId: wId }];
        }

        const newHistory = [...history, ...newEntries];
        setHistory(newHistory);
        setModalConfig({ show: true, context: 'post' });
        trackEvent('workout_complete', { workoutId: wId, exerciseCount: newEntries.length });
        syncData('history', newHistory);
        checkAchievements(newHistory, painLogs, weights);
    };

    const handleSaveWeight = (exId, weight) => {
        const newWeights = { ...weights, [exId]: weight };
        setWeights(newWeights);
        syncData('weights', newWeights);
        checkAchievements(history, painLogs, newWeights);
    };

    const dailyPrefill = useMemo(() => {
        const latestDaily = [...readinessLogs]
            .filter((log) => log.context === 'daily')
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];

        if (!latestDaily) return null;
        const createdAt = latestDaily.createdAt || latestDaily.date;
        const createdAtDate = createdAt ? new Date(createdAt) : null;
        if (!createdAtDate || Number.isNaN(createdAtDate.getTime())) return null;
        if (Date.now() - createdAtDate.getTime() > 12 * 60 * 60 * 1000) return null;
        const { sleep, stress } = latestDaily.values || {};
        if (sleep === null && stress === null) return null;
        return { sleep: sleep ?? null, stress: stress ?? null, createdAt };
    }, [readinessLogs]);

    const handleLogin = (newToken, userData) => {
        setLoading(true);
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('user_token', newToken);
    };

    const handleLogout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('user_token');
        // Clear data from view
        setHistory([]); setPainLogs([]); setReadinessLogs([]); setWeights({}); setAchievements([]);
    };

    const resetAll = () => {
        setHistory([]); setPainLogs([]); setReadinessLogs([]); setWeights({}); setAchievements([]);
        // Call API to reset if needed
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader className="animate-spin text-teal-600" size={32} /></div>;

    if (!token) return <AuthScreen onLogin={handleLogin} />;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 select-none">
            <div className="max-w-md mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden">
                {!activeWorkout && <Header level={levelData.level} xp={levelData.xp} xpToNext={levelData.xpToNext} onLogout={handleLogout} />}
                <main className={`${activeWorkout ? 'h-screen' : ''}`}>
                    {activeWorkout ? (
                        <WorkoutPlayer
                            workout={activeWorkout}
                            onClose={() => {
                                if (activeWorkout.source === 'list') {
                                    setActiveTab('workouts');
                                }
                                setActiveWorkout(null);
                            }}
                            onComplete={handleCompleteWorkout}
                            onLogPreReadiness={() => setModalConfig({ show: true, context: 'pre' })}
                            preSurveyDone={preSurveyDone}
                            savedWeights={weights}
                            onSaveWeight={handleSaveWeight}
                        />

                    ) : (
                        <>
                            {activeTab === 'home' && <HomeView startWorkout={(w, source) => { setPreSurveyDone(false); setActiveWorkout({ ...w, source }) }} history={history} painLogs={painLogs} readinessLogs={readinessLogs} onLogReadiness={(ctx) => setModalConfig({ show: true, context: ctx })} achievements={achievements} />}
                            {activeTab === 'workouts' && <WorkoutsView startWorkout={(w, source) => { setPreSurveyDone(false); setActiveWorkout({ ...w, source }) }} listState={listState} onListStateChange={setListState} />}
                            {activeTab === 'stats' && <StatsView history={history} painLogs={painLogs} resetAll={resetAll} achievements={achievements} openAchievements={() => setShowAchievements(true)} weights={weights} openMechanics={() => setShowMechanics(true)} />}

                        </>
                    )}
                </main>
                {!activeWorkout && <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />}

                {modalConfig.show && (
                    <ReadinessSurveyModal
                        context={modalConfig.context}
                        dailyPrefill={modalConfig.context === 'pre' ? dailyPrefill : null}
                        onClose={() => setModalConfig({ ...modalConfig, show: false })}
                        onComplete={handleSurveyComplete}
                        onSave={saveReadinessLog}
                    />
                )}
                {showAchievements && <AchievementsModal onClose={() => setShowAchievements(false)} userAchievements={achievements} />}
                {showMechanics && <MechanicsModal onClose={() => setShowMechanics(false)} />}
            </div>
        </div>
    );
}

export { AuthScreen, ReadinessSurveyModal, checkAchievementConditions, apiRequest, mockApi, WorkoutsView, WorkoutPlayer };
