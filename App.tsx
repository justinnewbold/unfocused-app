import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Modal, Animated, Platform, KeyboardAvoidingView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

type EnergyLevel = 'low' | 'medium' | 'high';
type ViewMode = 'conversation' | 'oneThing' | 'list' | 'timeline' | 'dashboard' | 'minimal';
type Personality = 'loyalFriend' | 'professional' | 'coach' | 'drillSergeant' | 'funny' | 'calm';
interface Task { id: string; title: string; energy: EnergyLevel; completed: boolean; isMicroStep: boolean; }
interface Message { id: string; role: 'nero' | 'user'; content: string; }
interface Achievement { id: string; name: string; emoji: string; points: number; }

const C = { primary: '#6C5CE7', bg: '#0F0F1A', card: '#252542', text: '#FFFFFF', textSec: '#B8B8D1', textMuted: '#6C6C8A', success: '#00B894', warning: '#FDCB6E', error: '#FF7675', border: '#3D3D5C', gold: '#F9CA24' };
const PERSONALITIES: Record<string, { name: string; emoji: string; greetings: string[] }> = {
  loyalFriend: { name: 'Loyal Friend', emoji: '🤗', greetings: ["Hey! 💙", "Hi friend!"] },
  professional: { name: 'Professional', emoji: '💼', greetings: ["Hello.", "Ready."] },
  coach: { name: 'Coach', emoji: '🏆', greetings: ["Let's go! 💪"] },
  drillSergeant: { name: 'Drill Sergeant', emoji: '🎖️', greetings: ["Attention!"] },
  funny: { name: 'Funny', emoji: '😄', greetings: ["Heyyy! 😄"] },
  calm: { name: 'Calm', emoji: '🧘', greetings: ["Welcome 🌿"] },
};
const VIEWS: Record<string, { name: string; emoji: string }> = { conversation: { name: 'Chat', emoji: '💬' }, oneThing: { name: 'Focus', emoji: '🎯' }, list: { name: 'List', emoji: '📝' }, timeline: { name: 'Time', emoji: '📅' }, dashboard: { name: 'Stats', emoji: '📊' }, minimal: { name: 'Zen', emoji: '🌙' } };
const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_task', name: 'First Step', emoji: '👣', points: 10 }, { id: 'five_tasks', name: 'Getting Going', emoji: '🚀', points: 25 },
  { id: 'ten_tasks', name: 'On a Roll', emoji: '🔥', points: 50 }, { id: 'first_chat', name: 'Hello Nero', emoji: '👋', points: 10 },
  { id: 'low_energy_win', name: 'Low Energy Hero', emoji: '🌙', points: 30 }, { id: 'micro_win', name: 'Micro Win', emoji: '✨', points: 10 },
];
const CELEBRATIONS = ['Nice!', 'Crushed it!', 'Amazing!', 'Win!', 'Boom! 🎉'];

const genId = () => Math.random().toString(36).substr(2, 9) + Date.now();
const getEC = (e: EnergyLevel) => e === 'high' ? C.success : e === 'medium' ? C.warning : C.error;
const getEE = (e: EnergyLevel) => e === 'high' ? '⚡' : e === 'medium' ? '✨' : '🌙';

export default function App() {
  const [screen, setScreen] = useState<'welcome' | 'onboarding' | 'main' | 'settings'>('welcome');
  const [view, setView] = useState<ViewMode>('conversation');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [neroName, setNeroName] = useState('Nero');
  const [personality, setPersonality] = useState<Personality>('loyalFriend');
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [stats, setStats] = useState({ tasks: 0, msgs: 0, lowWins: 0, micro: 0, pts: 0 });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newEnergy, setNewEnergy] = useState<EnergyLevel>('medium');
  const [showAdd, setShowAdd] = useState(false);
  const [showCeleb, setShowCeleb] = useState(false);
  const [celebText, setCelebText] = useState('');
  const [showAch, setShowAch] = useState<Achievement | null>(null);
  const [filter, setFilter] = useState<EnergyLevel | 'all'>('all');
  const [onbStep, setOnbStep] = useState(0);
  const celebAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const [t, m, s, a, p, o] = await Promise.all([
        AsyncStorage.getItem('@uf/tasks'), AsyncStorage.getItem('@uf/msgs'), AsyncStorage.getItem('@uf/stats'),
        AsyncStorage.getItem('@uf/ach'), AsyncStorage.getItem('@uf/profile'), AsyncStorage.getItem('@uf/onb'),
      ]);
      if (t) setTasks(JSON.parse(t)); if (m) setMessages(JSON.parse(m)); if (s) setStats(JSON.parse(s)); if (a) setAchievements(JSON.parse(a));
      if (p) { const pr = JSON.parse(p); setUserName(pr.name || ''); setNeroName(pr.nero || 'Nero'); setPersonality(pr.pers || 'loyalFriend'); }
      setScreen(o === 'true' ? 'main' : 'welcome');
    } catch (e) {} finally { setLoading(false); }
  };
  const save = async (k: string, d: any) => { try { await AsyncStorage.setItem(k, JSON.stringify(d)); } catch (e) {} };
  useEffect(() => { save('@uf/tasks', tasks); }, [tasks]);
  useEffect(() => { save('@uf/msgs', messages); }, [messages]);
  useEffect(() => { save('@uf/stats', stats); }, [stats]);
  useEffect(() => { save('@uf/ach', achievements); }, [achievements]);
  const saveProfile = () => save('@uf/profile', { name: userName, nero: neroName, pers: personality });

  const checkAch = (ns: typeof stats) => {
    const conds: Record<string, boolean> = { first_task: ns.tasks >= 1, five_tasks: ns.tasks >= 5, ten_tasks: ns.tasks >= 10, first_chat: ns.msgs >= 1, low_energy_win: ns.lowWins >= 1, micro_win: ns.micro >= 1 };
    for (const a of ACHIEVEMENTS) {
      if (conds[a.id] && !achievements.includes(a.id)) {
        setAchievements(p => [...p, a.id]); setShowAch(a); setStats(s => ({ ...s, pts: s.pts + a.points }));
        setTimeout(() => setShowAch(null), 3000); break;
      }
    }
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(p => [{ id: genId(), title: newTask.trim(), energy: newEnergy, completed: false, isMicroStep: false }, ...p]);
    setNewTask(''); setShowAdd(false);
  };

  const completeTask = (id: string) => {
    const t = tasks.find(x => x.id === id); if (!t || t.completed) return;
    setTasks(p => p.map(x => x.id === id ? { ...x, completed: true } : x));
    const ns = { ...stats, tasks: stats.tasks + 1, lowWins: energy === 'low' || t.energy === 'low' ? stats.lowWins + 1 : stats.lowWins, micro: t.isMicroStep ? stats.micro + 1 : stats.micro };
    setStats(ns); checkAch(ns);
    setCelebText(CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]); setShowCeleb(true);
    Animated.sequence([Animated.timing(celebAnim, { toValue: 1, duration: 300, useNativeDriver: true }), Animated.delay(1200), Animated.timing(celebAnim, { toValue: 0, duration: 300, useNativeDriver: true })]).start(() => setShowCeleb(false));
  };

  const breakdown = (id: string) => {
    const t = tasks.find(x => x.id === id); if (!t) return;
    const micro: Task[] = [
      { id: genId(), title: `Open: ${t.title.slice(0, 20)}`, energy: 'low', completed: false, isMicroStep: true },
      { id: genId(), title: 'Do smallest part', energy: 'low', completed: false, isMicroStep: true },
      { id: genId(), title: 'Continue 2 min', energy: 'low', completed: false, isMicroStep: true },
    ];
    setTasks(p => { const i = p.findIndex(x => x.id === id); const n = [...p]; n.splice(i + 1, 0, ...micro); return n; });
  };

  const send = async () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { id: genId(), role: 'user', content: input.trim() }]); setInput(''); setTyping(true);
    const ns = { ...stats, msgs: stats.msgs + 1 }; setStats(ns); checkAch(ns);
    const l = input.toLowerCase();
    if (['tired', 'exhausted', 'low'].some(w => l.includes(w))) setEnergy('low');
    else if (['great', 'good', 'energized'].some(w => l.includes(w))) setEnergy('high');
    setTimeout(() => {
      const resps = [`${PERSONALITIES[personality].greetings[0]} What's the ONE thing to tackle?`, `Got it! What's the smallest first step?`, `No pressure! What's on your mind?`, `You're doing great! 💙`];
      setMessages(p => [...p, { id: genId(), role: 'nero', content: resps[Math.floor(Math.random() * resps.length)] }]); setTyping(false);
    }, 1500);
  };

  const finishOnb = async () => { await AsyncStorage.setItem('@uf/onb', 'true'); saveProfile(); setScreen('main'); setMessages([{ id: genId(), role: 'nero', content: userName ? `${PERSONALITIES[personality].greetings[0]} Great to meet you, ${userName}! I'm ${neroName}.` : `${PERSONALITIES[personality].greetings[0]} I'm ${neroName}, ready to help!` }]); };

  if (loading) return <View style={[S.container, S.center]}><Text style={S.loadText}>Loading...</Text></View>;

  if (screen === 'welcome') {
    return (
      <SafeAreaView style={S.container}><StatusBar style="light" />
        <View style={S.welcomeC}>
          <Text style={S.logo}>🧠</Text><Text style={S.title}>UnFocused</Text><Text style={S.subtitle}>Your AI Companion for the ADHD Brain</Text>
          <View style={S.card}>
            <Text style={S.cardQ}>How much do you want to tell me?</Text>
            {[{ k: 'skip', e: '🚀', t: "Let's start", d: "I'll learn as we go" }, { k: 'quick', e: '💬', t: 'Quick questions', d: '~1 min' }, { k: 'deep', e: '🎯', t: 'Deep dive', d: 'Full setup' }].map(o => (
              <TouchableOpacity key={o.k} style={S.opt} onPress={() => o.k === 'skip' ? finishOnb() : setScreen('onboarding')}>
                <Text style={S.optE}>{o.e}</Text><View style={{ flex: 1 }}><Text style={S.optT}>{o.t}</Text><Text style={S.optD}>{o.d}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'onboarding') {
    const qs = [{ q: "What should I call you?", t: 'name' }, { q: "How should I talk to you?", t: 'pers' }];
    const cur = qs[onbStep];
    return (
      <SafeAreaView style={S.container}><StatusBar style="light" />
        <View style={S.onbC}>
          <View style={S.prog}><View style={[S.progFill, { width: `${((onbStep + 1) / qs.length) * 100}%` }]} /></View>
          <Text style={S.onbQ}>{cur.q}</Text>
          {cur.t === 'name' && <TextInput style={S.onbIn} value={userName} onChangeText={setUserName} placeholder="Your name (optional)" placeholderTextColor={C.textMuted} />}
          {cur.t === 'pers' && Object.entries(PERSONALITIES).slice(0, 3).map(([k, v]) => <TouchableOpacity key={k} style={[S.onbOpt, personality === k && S.onbOptSel]} onPress={() => setPersonality(k as Personality)}><Text style={S.onbOptT}>{v.emoji} {v.name}</Text></TouchableOpacity>)}
          <View style={S.onbBtns}>
            {onbStep > 0 && <TouchableOpacity style={S.backBtn} onPress={() => setOnbStep(s => s - 1)}><Text style={S.backBtnT}>← Back</Text></TouchableOpacity>}
            <TouchableOpacity style={S.nextBtn} onPress={() => onbStep < qs.length - 1 ? setOnbStep(s => s + 1) : finishOnb()}><Text style={S.nextBtnT}>{onbStep === qs.length - 1 ? "Let's go! 🚀" : 'Continue'}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={S.skipBtn} onPress={finishOnb}><Text style={S.skipBtnT}>Skip</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'settings') {
    return (
      <SafeAreaView style={S.container}><StatusBar style="light" />
        <View style={S.setHead}><TouchableOpacity onPress={() => setScreen('main')}><Text style={S.setBack}>← Back</Text></TouchableOpacity><Text style={S.setTitle}>Settings</Text><View style={{ width: 50 }} /></View>
        <ScrollView style={S.setCont}>
          <View style={S.setSec}><Text style={S.setSecT}>{neroName}'s Personality</Text>
            {Object.entries(PERSONALITIES).map(([k, v]) => <TouchableOpacity key={k} style={[S.setOpt, personality === k && S.setOptSel]} onPress={() => { setPersonality(k as Personality); saveProfile(); }}><Text style={S.setOptE}>{v.emoji}</Text><Text style={S.setOptT}>{v.name}</Text>{personality === k && <Text style={S.check}>✓</Text>}</TouchableOpacity>)}
          </View>
          <View style={S.setSec}><Text style={S.setSecT}>Stats</Text>
            <View style={S.statsG}><View style={S.statI}><Text style={S.statV}>{stats.tasks}</Text><Text style={S.statL}>Tasks</Text></View><View style={S.statI}><Text style={S.statV}>{stats.pts}</Text><Text style={S.statL}>Points</Text></View><View style={S.statI}><Text style={S.statV}>{achievements.length}/{ACHIEVEMENTS.length}</Text><Text style={S.statL}>Achievements</Text></View></View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const pending = tasks.filter(t => !t.completed);
  const filtered = filter === 'all' ? pending : pending.filter(t => t.energy === filter);
  const next = pending[0];

  return (
    <SafeAreaView style={S.container}><StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={S.head}><View style={S.headL}><Text style={S.headT}>{neroName}</Text>{energy && <View style={[S.eBadge, { backgroundColor: getEC(energy) }]}><Text style={S.eBadgeT}>{getEE(energy)} {energy}</Text></View>}</View><TouchableOpacity onPress={() => setScreen('settings')}><Text style={S.setIcon}>⚙️</Text></TouchableOpacity></View>
        {!energy && <View style={S.eSel}><Text style={S.eSelT}>How's your energy?</Text><View style={S.eOpts}>{(['low', 'medium', 'high'] as EnergyLevel[]).map(e => <TouchableOpacity key={e} style={[S.eOpt, { borderColor: getEC(e) }]} onPress={() => setEnergy(e)}><Text style={S.eOptT}>{getEE(e)} {e}</Text></TouchableOpacity>)}</View></View>}
        <View style={S.main}>
          {view === 'conversation' && <>
            <ScrollView ref={scrollRef} style={S.msgs} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
              {messages.map(m => <View key={m.id} style={[S.msg, m.role === 'user' ? S.msgU : S.msgN]}><Text style={S.msgT}>{m.content}</Text></View>)}
              {typing && <View style={[S.msg, S.msgN]}><Text style={S.msgT}>...</Text></View>}
            </ScrollView>
            <View style={S.inC}><View style={S.inR}><TextInput style={S.tIn} value={input} onChangeText={setInput} placeholder={`Talk to ${neroName}...`} placeholderTextColor={C.textMuted} multiline /><TouchableOpacity style={S.sendBtn} onPress={send}><Text style={S.sendBtnT}>→</Text></TouchableOpacity></View></View>
          </>}
          {view === 'oneThing' && <View style={S.oneC}>{next ? <><Text style={S.oneL}>Your ONE thing:</Text><View style={S.oneCard}><View style={[S.eDot, { backgroundColor: getEC(next.energy) }]} /><Text style={S.oneT}>{next.title}</Text>{next.isMicroStep && <Text style={S.microB}>✨ micro</Text>}</View><View style={S.oneActs}><TouchableOpacity style={S.oneDone} onPress={() => completeTask(next.id)}><Text style={S.oneDoneT}>✓ Done!</Text></TouchableOpacity><TouchableOpacity style={S.oneBreak} onPress={() => breakdown(next.id)}><Text style={S.oneBreakT}>🔨 Break it down</Text></TouchableOpacity></View></> : <View style={S.empty}><Text style={S.emptyE}>🎉</Text><Text style={S.emptyT}>All clear!</Text><TouchableOpacity style={S.addTaskBtn} onPress={() => setShowAdd(true)}><Text style={S.addTaskBtnT}>+ Add Task</Text></TouchableOpacity></View>}</View>}
          {view === 'list' && <View style={S.listC}><View style={S.listH}><Text style={S.listT}>Tasks ({filtered.length})</Text><TouchableOpacity style={S.addBtn} onPress={() => setShowAdd(true)}><Text style={S.addBtnT}>+ Add</Text></TouchableOpacity></View><View style={S.filterR}>{(['all', 'low', 'medium', 'high'] as const).map(f => <TouchableOpacity key={f} style={[S.filterBtn, filter === f && S.filterBtnA]} onPress={() => setFilter(f)}><Text style={[S.filterBtnT, filter === f && S.filterBtnTA]}>{f === 'all' ? 'All' : getEE(f)}</Text></TouchableOpacity>)}</View><ScrollView style={S.taskList}>{filtered.map(t => <View key={t.id} style={S.taskI}><TouchableOpacity style={[S.chk, t.completed && S.chkD]} onPress={() => completeTask(t.id)}>{t.completed && <Text>✓</Text>}</TouchableOpacity><View style={[S.taskE, { backgroundColor: getEC(t.energy) }]} /><Text style={[S.taskT, t.completed && S.taskTD]}>{t.title}</Text><TouchableOpacity onPress={() => breakdown(t.id)}><Text style={S.taskA}>🔨</Text></TouchableOpacity><TouchableOpacity onPress={() => setTasks(p => p.filter(x => x.id !== t.id))}><Text style={S.taskA}>🗑️</Text></TouchableOpacity></View>)}</ScrollView></View>}
          {view === 'timeline' && <ScrollView style={S.timeC}><Text style={S.timeT}>Timeline</Text>{[8,9,10,11,12,13,14,15,16,17,18,19].map(h => <View key={h} style={S.timeH}><Text style={S.timeTm}>{h > 12 ? `${h-12}PM` : `${h}AM`}</Text><View style={S.timeSlot}>{h === new Date().getHours() && <View style={S.curLine} />}</View></View>)}</ScrollView>}
          {view === 'dashboard' && <ScrollView style={S.dashC}><Text style={S.dashT}>Progress</Text><View style={S.dashStats}><View style={S.dashS}><Text style={S.dashSV}>{stats.tasks}</Text><Text style={S.dashSL}>Tasks</Text></View><View style={S.dashS}><Text style={S.dashSV}>{stats.pts}</Text><Text style={S.dashSL}>Points</Text></View></View><Text style={S.achT}>Achievements ({achievements.length}/{ACHIEVEMENTS.length})</Text><View style={S.achG}>{ACHIEVEMENTS.map(a => { const u = achievements.includes(a.id); return <View key={a.id} style={[S.achI, !u && S.achIL]}><Text style={S.achE}>{u ? a.emoji : '🔒'}</Text><Text style={S.achN}>{a.name}</Text></View>; })}</View></ScrollView>}
          {view === 'minimal' && <View style={S.minC}><Text style={S.minG}>Hey{userName ? `, ${userName}` : ''} 💙</Text><Text style={S.minM}>One tiny thing when ready.</Text>{next && <TouchableOpacity style={S.minTask} onPress={() => completeTask(next.id)}><Text style={S.minTaskT}>{next.title}</Text></TouchableOpacity>}</View>}
        </View>
        <View style={S.nav}>{Object.entries(VIEWS).map(([k, v]) => <TouchableOpacity key={k} style={S.navI} onPress={() => setView(k as ViewMode)}><Text style={S.navE}>{v.emoji}</Text><Text style={[S.navL, view === k && S.navLA]}>{v.name}</Text></TouchableOpacity>)}</View>
        <Modal visible={showAdd} transparent animationType="slide"><View style={S.mO}><View style={S.mC}><Text style={S.mT}>Add Task</Text><TextInput style={S.mIn} value={newTask} onChangeText={setNewTask} placeholder="What needs doing?" placeholderTextColor={C.textMuted} autoFocus /><Text style={S.mL}>Energy:</Text><View style={S.ePick}>{(['low', 'medium', 'high'] as EnergyLevel[]).map(e => <TouchableOpacity key={e} style={[S.ePickO, newEnergy === e && { borderColor: getEC(e), backgroundColor: getEC(e) + '20' }]} onPress={() => setNewEnergy(e)}><Text style={S.ePickT}>{getEE(e)}</Text></TouchableOpacity>)}</View><View style={S.mBtns}><TouchableOpacity style={S.mCancel} onPress={() => setShowAdd(false)}><Text style={S.mCancelT}>Cancel</Text></TouchableOpacity><TouchableOpacity style={S.mConfirm} onPress={addTask}><Text style={S.mConfirmT}>Add</Text></TouchableOpacity></View></View></View></Modal>
        {showCeleb && <Animated.View style={[S.celebO, { opacity: celebAnim, transform: [{ scale: celebAnim }] }]}><Text style={S.celebT}>{celebText}</Text></Animated.View>}
        {showAch && <View style={S.achToast}><Text style={S.achToastE}>{showAch.emoji}</Text><Text style={S.achToastN}>{showAch.name}</Text><Text style={S.achToastP}>+{showAch.points}</Text></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg }, center: { justifyContent: 'center', alignItems: 'center' }, loadText: { color: C.text, fontSize: 18 },
  welcomeC: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, logo: { fontSize: 64, marginBottom: 16 }, title: { fontSize: 36, fontWeight: 'bold', color: C.text, marginBottom: 8 }, subtitle: { fontSize: 16, color: C.textSec, marginBottom: 40, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }, cardQ: { fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 20, textAlign: 'center' },
  opt: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 16, marginBottom: 12 }, optE: { fontSize: 24, marginRight: 16 }, optT: { fontSize: 16, fontWeight: '600', color: C.text }, optD: { fontSize: 14, color: C.textSec },
  onbC: { flex: 1, padding: 20, justifyContent: 'center' }, prog: { height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 40 }, progFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 }, onbQ: { fontSize: 24, fontWeight: '600', color: C.text, marginBottom: 30, textAlign: 'center' }, onbIn: { backgroundColor: C.card, borderRadius: 12, padding: 16, fontSize: 18, color: C.text, marginBottom: 20 },
  onbOpt: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' }, onbOptSel: { borderColor: C.primary }, onbOptT: { fontSize: 16, color: C.text, textAlign: 'center' },
  onbBtns: { flexDirection: 'row', justifyContent: 'center', marginTop: 40, gap: 12 }, backBtn: { padding: 16 }, backBtnT: { color: C.textSec, fontSize: 16 }, nextBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32 }, nextBtnT: { color: C.text, fontSize: 16, fontWeight: '600' }, skipBtn: { alignItems: 'center', marginTop: 20 }, skipBtnT: { color: C.textMuted, fontSize: 14 },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }, setBack: { color: C.primary, fontSize: 16 }, setTitle: { color: C.text, fontSize: 18, fontWeight: '600' }, setCont: { flex: 1, padding: 16 }, setSec: { marginBottom: 32 }, setSecT: { color: C.textSec, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  setOpt: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8 }, setOptSel: { borderWidth: 2, borderColor: C.primary }, setOptE: { fontSize: 24, marginRight: 12 }, setOptT: { color: C.text, fontSize: 16, flex: 1 }, check: { color: C.primary, fontSize: 18 },
  statsG: { flexDirection: 'row', gap: 12 }, statI: { backgroundColor: C.card, borderRadius: 12, padding: 16, flex: 1, alignItems: 'center' }, statV: { color: C.text, fontSize: 24, fontWeight: 'bold' }, statL: { color: C.textSec, fontSize: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }, headL: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headT: { color: C.text, fontSize: 20, fontWeight: '600' }, setIcon: { fontSize: 24 },
  eBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }, eBadgeT: { color: C.bg, fontSize: 12, fontWeight: '600' },
  eSel: { backgroundColor: C.card, margin: 16, borderRadius: 16, padding: 16 }, eSelT: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' }, eOpts: { flexDirection: 'row', justifyContent: 'space-around' }, eOpt: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 2 }, eOptT: { color: C.text, fontSize: 14 },
  main: { flex: 1 },
  msgs: { flex: 1, padding: 16 }, msg: { maxWidth: '80%', padding: 14, borderRadius: 16, marginBottom: 12 }, msgN: { backgroundColor: C.card, alignSelf: 'flex-start' }, msgU: { backgroundColor: C.primary, alignSelf: 'flex-end' }, msgT: { color: C.text, fontSize: 15 },
  inC: { padding: 16, borderTopWidth: 1, borderTopColor: C.border }, inR: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, tIn: { flex: 1, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, color: C.text, fontSize: 15, maxHeight: 100 }, sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' }, sendBtnT: { color: C.text, fontSize: 20, fontWeight: 'bold' },
  oneC: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, oneL: { color: C.textSec, fontSize: 14, marginBottom: 16 }, oneCard: { backgroundColor: C.card, borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 350 }, eDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 16 }, oneT: { color: C.text, fontSize: 22, fontWeight: '600', textAlign: 'center' }, microB: { color: C.gold, fontSize: 14, marginTop: 8 },
  oneActs: { width: '100%', marginTop: 24, gap: 12 }, oneDone: { backgroundColor: C.success, borderRadius: 16, padding: 18, alignItems: 'center' }, oneDoneT: { color: C.text, fontSize: 18, fontWeight: '600' }, oneBreak: { backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center' }, oneBreakT: { color: C.textSec, fontSize: 14 },
  empty: { alignItems: 'center' }, emptyE: { fontSize: 48, marginBottom: 16 }, emptyT: { color: C.textSec, fontSize: 16, marginBottom: 24 }, addTaskBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 }, addTaskBtnT: { color: C.text, fontSize: 16, fontWeight: '600' },
  listC: { flex: 1, padding: 16 }, listH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, listT: { color: C.text, fontSize: 20, fontWeight: '600' }, addBtn: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }, addBtnT: { color: C.text, fontSize: 14, fontWeight: '600' },
  filterR: { flexDirection: 'row', gap: 8, marginBottom: 16 }, filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.card }, filterBtnA: { backgroundColor: C.primary }, filterBtnT: { color: C.textSec, fontSize: 14 }, filterBtnTA: { color: C.text },
  taskList: { flex: 1 }, taskI: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8 }, chk: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, chkD: { backgroundColor: C.success, borderColor: C.success }, taskE: { width: 4, height: 24, borderRadius: 2, marginRight: 12 }, taskT: { flex: 1, color: C.text, fontSize: 15 }, taskTD: { textDecorationLine: 'line-through', color: C.textMuted }, taskA: { fontSize: 16, marginLeft: 8 },
  timeC: { flex: 1, padding: 16 }, timeT: { color: C.text, fontSize: 20, fontWeight: '600', marginBottom: 20 }, timeH: { flexDirection: 'row', marginBottom: 2 }, timeTm: { width: 50, color: C.textMuted, fontSize: 12 }, timeSlot: { flex: 1, height: 48, backgroundColor: C.card, borderRadius: 4 }, curLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: C.primary },
  dashC: { flex: 1, padding: 16 }, dashT: { color: C.text, fontSize: 20, fontWeight: '600', marginBottom: 20 }, dashStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 32 }, dashS: { alignItems: 'center' }, dashSV: { color: C.text, fontSize: 32, fontWeight: 'bold' }, dashSL: { color: C.textSec, fontSize: 12 },
  achT: { color: C.text, fontSize: 18, fontWeight: '600', marginBottom: 16 }, achG: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, achI: { backgroundColor: C.card, borderRadius: 12, padding: 16, width: '30%', alignItems: 'center' }, achIL: { opacity: 0.5 }, achE: { fontSize: 28, marginBottom: 8 }, achN: { color: C.text, fontSize: 11, textAlign: 'center' },
  minC: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }, minG: { color: C.text, fontSize: 28, fontWeight: '300', marginBottom: 16 }, minM: { color: C.textSec, fontSize: 16, marginBottom: 40 }, minTask: { backgroundColor: C.card, borderRadius: 20, padding: 24 }, minTaskT: { color: C.text, fontSize: 18 },
  nav: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 8 }, navI: { alignItems: 'center', padding: 8 }, navE: { fontSize: 20 }, navL: { color: C.textMuted, fontSize: 10, marginTop: 4 }, navLA: { color: C.primary },
  mO: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }, mC: { backgroundColor: C.card, borderRadius: 20, padding: 24 }, mT: { color: C.text, fontSize: 20, fontWeight: '600', marginBottom: 16 }, mL: { color: C.textSec, fontSize: 14, marginBottom: 8 }, mIn: { backgroundColor: C.bg, borderRadius: 12, padding: 16, color: C.text, fontSize: 16, marginBottom: 16 },
  ePick: { flexDirection: 'row', gap: 8, marginBottom: 24 }, ePickO: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: C.border, alignItems: 'center' }, ePickT: { color: C.text, fontSize: 18 },
  mBtns: { flexDirection: 'row', gap: 12 }, mCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center' }, mCancelT: { color: C.textSec, fontSize: 16 }, mConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center' }, mConfirmT: { color: C.text, fontSize: 16, fontWeight: '600' },
  celebO: { position: 'absolute', top: '40%', left: '10%', right: '10%', backgroundColor: C.success, borderRadius: 20, padding: 24, alignItems: 'center' }, celebT: { color: C.text, fontSize: 24, fontWeight: 'bold' },
  achToast: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: C.gold, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }, achToastE: { fontSize: 32, marginRight: 12 }, achToastN: { color: C.bg, fontSize: 16, fontWeight: 'bold', flex: 1 }, achToastP: { color: C.bg, fontSize: 18, fontWeight: 'bold' },
});
