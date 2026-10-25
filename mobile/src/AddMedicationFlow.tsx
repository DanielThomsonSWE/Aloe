/**
 * AddMedicationFlow — implements the "Start - Add Medication & Schedule" Figma section
 * (node 418-3570). Three screens:
 *   1. Add medication — Details   (418-3571)
 *   2. Add medication — Schedule  (418-3623)
 *   3. Add time                   (418-3682 / 418-3775)
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from './icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeEntry {
  hour: string;   // "8"
  minute: string; // "00"
  period: 'AM' | 'PM';
  days: Day[];
  reminder: boolean;
}

type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface AddMedicationResult {
  name: string;
  dosage: string;
  description: string;
  times: TimeEntry[];
}

interface Props {
  mode?: 'add' | 'edit';
  initialValue?: AddMedicationResult;
  busy: boolean;
  saveError?: string;
  onSave: (result: AddMedicationResult) => Promise<boolean>;
  onCancel: () => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, label }: { step: 1 | 2 | 3; label: string }) {
  return (
    <View style={si.row}>
      <Text style={si.label}>{label}</Text>
      <View style={si.progress}>
        <View style={[si.segment, step >= 1 && si.active]} />
        <View style={[si.segment, step >= 2 && si.active]} />
        <View style={[si.segment, step >= 3 && si.active]} />
      </View>
    </View>
  );
}
const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  progress: { flexDirection: 'row', gap: 5 },
  segment: { width: 20, height: 3, borderRadius: 2, backgroundColor: '#e0e0e0' },
  active: { backgroundColor: '#202020' },
});

// ─── App header ───────────────────────────────────────────────────────────────

function AppHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={ah.row}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [ah.backBtn, pressed && { opacity: 0.5 }]}
        hitSlop={8}
      >
        <Icon name="calendarBack" />
      </Pressable>
      <Text style={ah.title}>{title}</Text>
    </View>
  );
}
const ah = StyleSheet.create({
  row: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#202020' },
});

// ─── Medication summary card (used on Schedule + Add Time screens) ─────────────

function MedSummary({ name, dosage }: { name: string; dosage: string }) {
  return (
    <View style={ms.card}>
      <Icon name="medication" />
      <View style={ms.info}>
        <Text style={ms.name}>{name}</Text>
        <Text style={ms.dose}>{dosage}</Text>
      </View>
    </View>
  );
}
const ms = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, minHeight: 67 },
  info: { flex: 1, gap: 5 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  dose: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959' },
});

// ─── Screen 1: Medication Details ─────────────────────────────────────────────

interface Screen1Props {
  name: string; setName: (v: string) => void;
  dosage: string; setDosage: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  error: string;
  onContinue: () => void;
  onCancel: () => void;
}
function DetailsScreen({ name, setName, dosage, setDosage, description, setDescription, error, onContinue, onCancel }: Screen1Props) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={d.scroll} keyboardShouldPersistTaps="handled">
        <StepIndicator step={1} label="Step 1 of 3 - Details" />
        <Text style={d.title}>Medication details</Text>
        <Text style={d.supporting}>Enter your medication and dose, then set when to take it.</Text>

        <View style={d.fields}>
          <View style={d.field}>
            <Text style={d.fieldLabel}>Medication name</Text>
            <TextInput
              accessibilityLabel="Medication name"
              value={name}
              onChangeText={setName}
              placeholder="Atorvastatin (Lipitor)"
              placeholderTextColor="#aaa"
              style={d.input}
              autoFocus
              maxLength={100}
              returnKeyType="next"
            />
          </View>
          <View style={d.field}>
            <Text style={d.fieldLabel}>Dose</Text>
            <TextInput
              accessibilityLabel="Dose"
              value={dosage}
              onChangeText={setDosage}
              placeholder="20 mg"
              placeholderTextColor="#aaa"
              style={d.input}
              maxLength={80}
              returnKeyType="done"
            />
          </View>
          <View style={d.field}>
            <Text style={d.fieldLabel}>Description (optional)</Text>
            <TextInput
              accessibilityLabel="Medication description"
              value={description}
              onChangeText={setDescription}
              placeholder="Once daily, morning"
              placeholderTextColor="#aaa"
              style={d.input}
              maxLength={500}
              returnKeyType="done"
            />
          </View>
        </View>

        {!!error && <Text accessibilityRole="alert" style={d.error}>{error}</Text>}

        <Text style={d.guidance}>Follow your prescribed dose and schedule.</Text>

        <Pressable
          accessibilityRole="button"
          onPress={onContinue}
          style={({ pressed }) => [d.primaryBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={d.primaryText}>Continue to schedule</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onCancel} style={d.cancelBtn}>
          <Text style={d.cancelText}>Cancel and return Home</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const d = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 0 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, color: '#202020', marginTop: 20, marginBottom: 16 },
  supporting: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#595959', marginBottom: 24 },
  fields: { gap: 20, marginBottom: 24 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  input: { height: 50, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#202020' },
  guidance: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959', marginBottom: 20 },
  primaryBtn: { height: 52, backgroundColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959', textDecorationLine: 'underline' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9d2626', marginBottom: 12 },
});

// ─── Screen 2: Schedule ───────────────────────────────────────────────────────

function formatTime(t: TimeEntry) {
  const h = t.hour || '0';
  const m = t.minute || '00';
  return `${h}:${m} ${t.period}`;
}
function formatDays(days: Day[]) {
  if (days.length === 7) return 'Daily (Mon-Sun)';
  if (days.length === 5 && !days.includes('Sat') && !days.includes('Sun')) return 'Weekdays';
  if (days.length === 2 && days.includes('Sat') && days.includes('Sun')) return 'Weekends';
  return days.join(', ');
}

interface Screen2Props {
  name: string; dosage: string;
  times: TimeEntry[];
  busy: boolean;
  error: string;
  onAddTime: () => void;
  onBack: () => void;
  onContinue: () => void;
}

function ScheduleScreen({ name, dosage, times, busy, error, onAddTime, onBack, onContinue }: Screen2Props) {
  return (
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={sc.scroll} keyboardShouldPersistTaps="handled">
      <StepIndicator step={2} label="Step 2 of 3 - Schedule" />
      <Text style={sc.title}>Set your schedule</Text>

      <MedSummary name={name} dosage={dosage} />

      {/* Times section */}
      <View style={sc.timesBox}>
        <Text style={sc.sectionTitle}>Exact times</Text>
        {times.length === 0 ? (
          <View style={sc.emptyState}>
            <Text style={sc.emptyTitle}>No exact times added yet</Text>
            <Text style={sc.emptyNote}>Add the clock time, then choose repeat days for each dose.</Text>
          </View>
        ) : (
          <View style={sc.timeList}>
            {times.map((t, i) => (
              <View key={i} style={sc.timeChip}>
                <Text style={sc.timeChipText}>{formatTime(t)}</Text>
                <Text style={sc.timeChipSub}>{formatDays(t.days)}{t.reminder ? ' · Reminder on' : ''}</Text>
              </View>
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onAddTime}
          style={({ pressed }) => [sc.addTimeBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={sc.addTimePlus}>+</Text>
          <Text style={sc.addTimeLabel}>Add exact time</Text>
        </Pressable>
      </View>

        {!!error && <Text accessibilityRole="alert" style={sc.error}>{error}</Text>}
        <Text style={sc.guidance}>Follow your prescribed dose and schedule.</Text>

      <View style={sc.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [sc.secondaryBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={sc.secondaryText}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onContinue}
          disabled={busy || times.length === 0}
          style={({ pressed }) => [sc.primaryBtn, (busy || times.length === 0) && sc.disabledBtn, pressed && { opacity: 0.75 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={sc.primaryText}>Continue</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}
const sc = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 16 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, color: '#202020', marginTop: 20 },
  timesBox: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, gap: 12 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  emptyState: { alignItems: 'center', paddingVertical: 12, gap: 6 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  emptyNote: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959', textAlign: 'center', lineHeight: 18 },
  timeList: { gap: 8 },
  timeChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  timeChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  timeChipSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  addTimeBtn: { height: 52, backgroundColor: '#595959', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addTimePlus: { fontSize: 18, color: '#fff', lineHeight: 22 },
  addTimeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  guidance: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9d2626' },
  actions: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flex: 1, height: 52, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  primaryBtn: { flex: 1, height: 52, backgroundColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  disabledBtn: { backgroundColor: '#b8b8b8' },
});

// ─── Step 3: Review and save ──────────────────────────────────────────────────

interface ReviewProps {
  name: string; dosage: string; description: string; times: TimeEntry[]; busy: boolean; error: string;
  onEditDetails: () => void; onEditSchedule: () => void; onBack: () => void; onSave: () => void;
}
function ReviewScreen({ name, dosage, description, times, busy, error, onEditDetails, onEditSchedule, onBack, onSave }: ReviewProps) {
  return (
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={rv.scroll} keyboardShouldPersistTaps="handled">
      <StepIndicator step={3} label="Step 3 of 3 · Review" />
      <Text style={rv.title}>Review medication</Text>
      <Text style={rv.supporting}>Check your details and the schedule you entered before saving.</Text>

      <View style={rv.card}>
        <View style={rv.cardHeading}><Text style={rv.sectionTitle}>Medication details</Text><Pressable accessibilityRole="button" onPress={onEditDetails}><Text style={rv.edit}>Edit</Text></Pressable></View>
        <Text style={rv.name}>{name}</Text>
        <Text style={rv.body}>{dosage}</Text>
        {!!description && <Text style={rv.body}>{description}</Text>}
      </View>

      <View style={rv.card}>
        <View style={rv.cardHeading}><Text style={rv.sectionTitle}>Schedule</Text><Pressable accessibilityRole="button" onPress={onEditSchedule}><Text style={rv.edit}>Edit</Text></Pressable></View>
        {times.map((time, index) => <View key={`${index}-${time.hour}-${time.minute}`} style={rv.timeRow}>
          <Text style={rv.name}>{formatTime(time)}</Text>
          <Text style={rv.body}>{formatDays(time.days)} · Reminder {time.reminder ? 'on' : 'off'}</Text>
        </View>)}
        <Text style={rv.note}>Your local time · Each time can repeat on selected days.</Text>
      </View>

      {!!error && <Text accessibilityRole="alert" style={rv.error}>{error}</Text>}
      <Text style={rv.note}>Follow your prescribed dose and schedule.</Text>
      <View style={rv.actions}>
        <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} style={rv.secondaryBtn}><Text style={rv.secondaryText}>Back</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} disabled={busy} style={[rv.primaryBtn, busy && { opacity: 0.65 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={rv.primaryText}>Save</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}
const rv = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 16 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, color: '#202020', marginTop: 20 },
  supporting: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#595959' },
  card: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 14, gap: 8 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  edit: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020', textDecorationLine: 'underline' },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#595959' },
  timeRow: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, gap: 3 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#595959' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#9d2626' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondaryBtn: { flex: 1, height: 52, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  primaryBtn: { flex: 1, height: 52, backgroundColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});

function SavedScreen({ name, dosage, description, times, mode, error, onDone }: { name: string; dosage: string; description: string; times: TimeEntry[]; mode: 'add' | 'edit'; error: string; onDone: () => void }) {
  return (
    <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={sv.scroll}>
      <View style={sv.successMark}><Text style={sv.check}>✓</Text></View>
      <Text style={sv.eyebrow}>{mode === 'edit' ? 'Changes saved' : 'Saved to your medications'}</Text>
      <Text style={sv.title}>{mode === 'edit' ? 'Medication updated' : 'Medication scheduled'}</Text>
      <Text style={sv.body}>{mode === 'edit' ? `${name} and its schedule have been updated.` : `${name} and your entered schedule have been saved.`}</Text>
      <View style={sv.card}>
        <View style={sv.justAdded}><Text style={sv.addedText}>{mode === 'edit' ? 'Reminder' : 'Just added · Reminder'} {times.some(time => time.reminder) ? 'on' : 'off'}</Text></View>
        <Text style={sv.name}>{name}</Text>
        {!!description && <Text style={sv.body}>{description}</Text>}
        <Text style={sv.body}>{dosage} · {times.map(formatTime).join(' · ')} · {times.map(time => formatDays(time.days)).join(' · ')}</Text>
      </View>
      {!!error && <Text accessibilityRole="alert" style={sv.error}>{error}</Text>}
      <Pressable accessibilityRole="button" onPress={onDone} style={sv.button}><Text style={sv.buttonText}>Done</Text></Pressable>
    </ScrollView>
  );
}
const sv = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 32, gap: 14, alignItems: 'stretch' },
  successMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e9f1ed', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  check: { fontSize: 24, color: '#397154' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center', color: '#397154' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, textAlign: 'center', color: '#202020' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#595959', textAlign: 'center' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#9d2626', textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 14, gap: 8, marginTop: 12 },
  justAdded: { alignSelf: 'flex-start', backgroundColor: '#f2f5f3', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  addedText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#397154' },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  button: { height: 52, backgroundColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});

// ─── Screen 3: Add Time ───────────────────────────────────────────────────────

const WEEK_DAYS: { key: Day; label: string }[] = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' },
];
const WEEKDAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const isDaily = (days: Day[]) => days.length === WEEKDAYS.length && WEEKDAYS.every(day => days.includes(day));

interface Screen3Props {
  name: string; dosage: string;
  onSave: (entry: TimeEntry) => void;
  onCancel: () => void;
}
function AddTimeScreen({ name, dosage, onSave, onCancel }: Screen3Props) {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [days, setDays] = useState<Day[]>([...WEEKDAYS]);
  const [reminder, setReminder] = useState(false);
  const [error, setError] = useState('');

  const toggleDay = (day: Day) => {
    setDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };
  const toggleDaily = () => {
    setDays(prev => (isDaily(prev) ? [] : [...WEEKDAYS]));
  };

  const handleSave = () => {
    if (!hour) { setError('Please enter a time.'); return; }
    const h = parseInt(hour, 10);
    if (isNaN(h) || h < 1 || h > 12) { setError('Enter a valid hour (1-12).'); return; }
    if (minute && (isNaN(parseInt(minute, 10)) || parseInt(minute, 10) > 59)) { setError('Enter a valid minute (00-59).'); return; }
    if (days.length === 0) { setError('Select at least one day.'); return; }
    onSave({ hour, minute: minute.padStart(2, '0') || '00', period, days, reminder });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={at.scroll} keyboardShouldPersistTaps="handled">
        <StepIndicator step={2} label="Step 2 of 3 - Schedule" />
        <Text style={at.title}>Add exact time</Text>
        <MedSummary name={name} dosage={dosage} />

        {/* Time form */}
        <View style={at.formBox}>
          {/* Time field */}
          <View style={at.fieldSection}>
            <Text style={at.fieldLabel}>Exact time</Text>
            <View style={at.timeControls}>
              {/* Time input */}
              <View style={at.timeInput}>
                <TextInput
                  accessibilityLabel="Hour"
                  value={hour}
                  onChangeText={v => { setHour(v.replace(/[^0-9]/g, '').slice(0, 2)); setError(''); }}
                  placeholder="0"
                  placeholderTextColor="#b8b8b8"
                  keyboardType="number-pad"
                  style={at.timeHour}
                  maxLength={2}
                />
                <Text style={at.timeColon}>:</Text>
                <TextInput
                  accessibilityLabel="Minute"
                  value={minute}
                  onChangeText={v => { setMinute(v.replace(/[^0-9]/g, '').slice(0, 2)); setError(''); }}
                  placeholder="00"
                  placeholderTextColor="#b8b8b8"
                  keyboardType="number-pad"
                  style={at.timeMin}
                  maxLength={2}
                />
              </View>
              {/* AM/PM */}
              <View style={at.periodBox}>
                <Pressable
                  onPress={() => setPeriod('AM')}
                  style={[at.periodOption, period === 'AM' && at.periodSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: period === 'AM' }}
                >
                  <Text style={[at.periodLabel, period === 'AM' && at.periodLabelSelected]}>AM</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPeriod('PM')}
                  style={[at.periodOption, period === 'PM' && at.periodSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: period === 'PM' }}
                >
                  <Text style={[at.periodLabel, period === 'PM' && at.periodLabelSelected]}>PM</Text>
                </Pressable>
              </View>
            </View>
            <Text style={at.convention}>Your local time</Text>
          </View>

          {/* Repeat days field */}
          <View style={at.fieldSection}>
            <View style={at.fieldHeading}>
              <Text style={at.fieldLabel}>Repeat days</Text>
              <Text style={at.entryScope}>For this time</Text>
            </View>
            <View style={at.dayControls}>
              {/* Daily shortcut row */}
              <Pressable
                onPress={toggleDaily}
                style={[at.dailyRow, isDaily(days) && at.dailyRowSelected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDaily(days) }}
              >
                <Icon name="calendar" />
                <Text style={[at.dailyLabel, isDaily(days) && at.dailyLabelSelected]}>
                  Weekdays (Mon-Fri)
                </Text>
              </Pressable>
              {/* Individual day buttons */}
              <View style={at.dayRow}>
                {WEEK_DAYS.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    onPress={() => toggleDay(key)}
                    style={[at.dayBtn, days.includes(key) && at.dayBtnSelected]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: days.includes(key) }}
                    accessibilityLabel={key}
                  >
                    <Text style={[at.dayLabel, days.includes(key) && at.dayLabelSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={at.daysSummary}>
                {days.length === 0 ? 'No days selected' : `Choose repeat days: ${formatDays(days)}`}
              </Text>
            </View>
          </View>

          {/* Reminder field */}
          <View style={at.fieldSection}>
            <Text style={at.fieldLabel}>Reminder</Text>
            <View style={at.reminderRow}>
              <View style={at.reminderCopy}>
                <Text style={at.reminderLabel}>Set reminder</Text>
                <Text style={at.reminderNote}>{reminder ? `On · ${formatTime({ hour, minute: minute.padStart(2, '0') || '00', period, days, reminder })} · ${formatDays(days)}` : 'Off · optional'}</Text>
              </View>
              <Switch
                value={reminder}
                onValueChange={setReminder}
                accessibilityLabel="Set reminder"
                trackColor={{ false: '#e0e0e0', true: '#202020' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {!!error && <Text accessibilityRole="alert" style={at.error}>{error}</Text>}
        <Text style={at.guidance}>Follow your prescribed dose and schedule.</Text>

        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [at.cancelOutlineBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={at.cancelOutlineText}>Cancel</Text>
        </Pressable>
      </ScrollView>

      {/* Save button pinned above keyboard */}
      <View style={at.saveBtnWrap}>
        <Pressable
          accessibilityRole="button"
          onPress={handleSave}
          style={({ pressed }) => [at.saveBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={at.saveBtnText}>Add exact time</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const at = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 100, gap: 16 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, color: '#202020', marginTop: 20 },
  formBox: { gap: 24 },
  fieldSection: { gap: 8 },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  fieldHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryScope: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  timeControls: { flexDirection: 'row', gap: 12 },
  timeInput: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, paddingHorizontal: 14, gap: 4 },
  timeHour: { fontFamily: 'Inter_400Regular', fontSize: 24, color: '#202020', width: 36, padding: 0, textAlign: 'center' },
  timeColon: { fontFamily: 'Inter_400Regular', fontSize: 24, color: '#202020' },
  timeMin: { fontFamily: 'Inter_400Regular', fontSize: 24, color: '#202020', width: 36, padding: 0, textAlign: 'center' },
  periodBox: { flexDirection: 'row', height: 56, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, overflow: 'hidden', alignItems: 'center', paddingHorizontal: 4, gap: 4 },
  periodOption: { width: 62, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  periodSelected: { backgroundColor: '#202020' },
  periodLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#595959' },
  periodLabelSelected: { color: '#fff' },
  convention: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  dayControls: { gap: 8 },
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8 },
  dailyRowSelected: { backgroundColor: '#595959', borderColor: '#595959' },
  dailyLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#202020', flex: 1 },
  dailyLabelSelected: { color: '#fff' },
  dayRow: { flexDirection: 'row' },
  dayBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e0e0e0', marginRight: -1 },
  dayBtnSelected: { backgroundColor: '#202020', zIndex: 1 },
  dayLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  dayLabelSelected: { color: '#fff' },
  daysSummary: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  reminderCopy: { flex: 1, gap: 2 },
  reminderLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#202020' },
  reminderNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  guidance: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959' },
  cancelOutlineBtn: { height: 52, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelOutlineText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#9d2626' },
  saveBtnWrap: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  saveBtn: { height: 52, backgroundColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
});

// ─── Main flow orchestrator ────────────────────────────────────────────────────

type FlowStep = 'details' | 'schedule' | 'addTime' | 'review' | 'saved';

export function AddMedicationFlow({ mode = 'add', initialValue, busy, saveError = '', onSave, onCancel }: Props) {
  const [step, setStep] = useState<FlowStep>('details');
  const [name, setName] = useState(initialValue?.name ?? '');
  const [dosage, setDosage] = useState(initialValue?.dosage ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [times, setTimes] = useState<TimeEntry[]>(initialValue?.times ?? []);
  const [detailsError, setDetailsError] = useState('');

  const goToSchedule = useCallback(() => {
    if (!name.trim() || !dosage.trim()) {
      setDetailsError('Please enter both medication name and dose.');
      return;
    }
    setDetailsError('');
    setStep('schedule');
  }, [name, dosage]);

  const addTime = useCallback((entry: TimeEntry) => {
    setTimes(prev => [...prev, entry]);
    setStep('schedule');
  }, []);

  const finish = useCallback(async () => {
    const saved = await onSave({ name: name.trim(), dosage: dosage.trim(), description: description.trim(), times });
    if (saved) setStep('saved');
  }, [name, dosage, description, times, onSave]);

  if (step === 'details') {
    return (
      <>
        <AppHeader title={mode === 'edit' ? 'Edit medication' : 'Add medication'} onBack={onCancel} />
        <DetailsScreen
          name={name} setName={setName}
          dosage={dosage} setDosage={setDosage}
          description={description} setDescription={setDescription}
          error={detailsError}
          onContinue={goToSchedule}
          onCancel={onCancel}
        />
      </>
    );
  }

  if (step === 'schedule') {
    return (
      <>
        <AppHeader title={mode === 'edit' ? 'Edit medication' : 'Add medication'} onBack={() => setStep('details')} />
        <ScheduleScreen
          name={name} dosage={dosage}
          times={times}
          busy={busy}
          error=""
          onAddTime={() => setStep('addTime')}
          onBack={() => setStep('details')}
          onContinue={() => setStep('review')}
        />
      </>
    );
  }

  if (step === 'review') {
    return (
      <>
        <AppHeader title={mode === 'edit' ? 'Edit medication' : 'Add medication'} onBack={() => setStep('schedule')} />
        <ReviewScreen
          name={name} dosage={dosage} description={description} times={times} busy={busy} error={saveError}
          onEditDetails={() => setStep('details')}
          onEditSchedule={() => setStep('schedule')}
          onBack={() => setStep('schedule')}
          onSave={() => { void finish(); }}
        />
      </>
    );
  }

  if (step === 'saved') {
    return (
      <>
        <AppHeader title="Your medications" onBack={onCancel} />
        <SavedScreen name={name} dosage={dosage} description={description} times={times} mode={mode} error={saveError} onDone={onCancel} />
      </>
    );
  }

  // addTime
  return (
    <>
      <AppHeader title={mode === 'edit' ? 'Edit medication' : 'Add medication'} onBack={() => setStep('schedule')} />
      <AddTimeScreen
        name={name} dosage={dosage}
        onSave={addTime}
        onCancel={() => setStep('schedule')}
      />
    </>
  );
}
