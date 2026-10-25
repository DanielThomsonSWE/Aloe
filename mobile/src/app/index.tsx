import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { trackFirst } from '../analytics';
import { Icon, IconName } from '../icons';
import { AddMedicationFlow, AddMedicationResult } from '../AddMedicationFlow';
import { Medication, medications, visibleMedications } from '../medications';
import { watchAuthState } from '../supabase';
import { cancelMedicationReminders, parseReminderSchedule, replaceMedicationReminders, requestReminderPermission, scheduleMedicationReminders } from '../reminders';
import { styles as s } from '../styles';
import { useViewportLayout } from '../useViewportLayout';

const disclaimer = 'Example information, not personal medical advice. Check with your pharmacist.';
type Sheet = { kind: 'detail'; item: Medication } | { kind: 'soon'; title: string } | null;
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';

function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height, onLayout } = useViewportLayout();
  const web = Platform.OS === 'web';
  const desktop = web && width >= 600;
  const [items, setItems] = useState<Medication[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [adding, setAdding] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [formError, setFormError] = useState('');
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const filtered = useMemo(() => visibleMedications(items, query), [items, query]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await medications.list()); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    const stopWatchingAuth = watchAuthState();
    void medications.list().then(value => {
      if (active) setItems(value);
    }).catch(e => {
      if (active) setError(message(e));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; stopWatchingAuth(); };
  }, []);
  const open = (value: Sheet) => {
    setSheet(value); setFormError(''); setConfirmRemove(false);
  };
  const close = useCallback(() => { if (!busyRef.current) setSheet(null); }, []);
  useEffect(() => {
    if (!web || !sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, close, web]);
  async function mutate(action: () => Promise<void>, onError: (value: string) => void) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); onError('');
    try { await action(); }
    catch (e) { onError(message(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const pin = (item: Medication) => mutate(async () => {
    const updated = await medications.pin(item.id, !item.pinned);
    setItems(current => current.map(value => value.id === updated.id ? updated : value));
  }, setError);
  const saveFlow = async (result: AddMedicationResult) => {
    const schedule = result.times.map(time =>
      `${time.hour}:${time.minute.padStart(2, '0')} ${time.period} (${time.days.join(', ')})${time.reminder ? ' · Reminder on' : ''}`
    ).join(' · ');
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setFlowError('');
    try {
      if (!result.times.length) throw new Error('Add at least one exact time to the schedule.');
      if (result.times.some(time => time.reminder)) await requestReminderPermission();

      const input = {
        name: result.name,
        dosage: result.dosage,
        description: result.description,
        schedule,
      };

      if (editingMedication) {
        const updated = await medications.update(editingMedication.id, input);
        setItems(current => current.map(item => item.id === updated.id ? updated : item));
        setEditingMedication(updated);
        if (Platform.OS !== 'web') {
          try {
            await replaceMedicationReminders(updated.id, { name: updated.name, dosage: updated.dosage, description: updated.description, times: result.times });
          } catch {
            setFlowError('Medication saved, but its reminders could not be updated. Please try again.');
          }
        }
      } else {
        const item = await medications.add(input);
        try {
          await scheduleMedicationReminders(item.id, result);
        } catch (e) {
          await medications.remove(item.id);
          throw e;
        }
        setItems(current => [...current, item]);
        setQuery('');
      }
      return true;
    } catch (e) {
      setFlowError(message(e));
      return false;
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };
  const cancelMedicationFlow = () => {
    setAdding(false); setFlowError('');
    if (editingMedication) setSheet({ kind: 'detail', item: editingMedication });
    setEditingMedication(null);
  };
  const startEditing = (item: Medication) => {
    setFormError(''); setConfirmRemove(false); setSheet(null);
    setEditingMedication(item); setFlowError(''); setAdding(true);
  };
  const remove = (item: Medication) => mutate(async () => {
    await cancelMedicationReminders(item.id);
    await medications.remove(item.id);
    setItems(current => current.filter(value => value.id !== item.id)); setSheet(null);
  }, setFormError);

  return <View onLayout={onLayout} style={[s.stage, desktop && s.desktopStage]}>
    <StatusBar style="dark" />
    <View testID="phone" style={[
      s.phone,
      desktop && { width: 400, height: Math.min(height - 48, 876), flexGrow: 0, flexShrink: 0, flexBasis: 'auto', borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 40 },
      web && !desktop && { borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 40 },
    ]}>
      {web ? <View style={s.status} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={s.statusTime}>9:41</Text><View style={s.deviceStatus}><Icon name="signal" /><Icon name="wifi" /><Icon name="battery" /></View>
      </View> : <View style={{ height: insets.top }} />}
      {adding ? <View style={{ flex: 1, minHeight: 0 }}>
        <AddMedicationFlow
          mode={editingMedication ? 'edit' : 'add'}
          initialValue={editingMedication ? {
            name: editingMedication.name,
            dosage: editingMedication.dosage,
            description: editingMedication.description,
            times: parseReminderSchedule(editingMedication.schedule),
          } : undefined}
          busy={busy}
          saveError={flowError}
          onSave={saveFlow}
          onCancel={cancelMedicationFlow}
        />
      </View> : <>
      <View style={s.header}><Icon name="brand" /><Text style={s.brand}>Aloe</Text></View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={load} />}>
        <Text role="heading" style={s.title}>Your medications</Text>
        <View style={s.search}>
          <Icon name="search" /><TextInput value={query} onChangeText={setQuery} placeholder="Search saved medications" placeholderTextColor="#595959"
            accessibilityLabel="Search saved medications" style={s.searchInput} autoCorrect={false} returnKeyType="search" />
          {!!query && <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}><Text style={s.clear}>×</Text></Pressable>}
        </View>
        {!!error && <View style={s.errorBox}><Text accessibilityRole="alert" style={s.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={load}><Text style={s.link}>Retry</Text></Pressable></View>}
        {loading && !items.length ? <View style={s.empty}><ActivityIndicator color="#202020" /><Text style={s.muted}>Loading medications…</Text></View> :
          <View style={s.list}>
            {filtered.map(item => <View key={item.id} style={s.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.name}, ${item.dosage}, ${item.schedule || 'no exact times saved'}, ${item.description}`}
                onPress={() => open({ kind: 'detail', item })} style={({ pressed }) => [s.cardMain, pressed && s.pressed]}>
                <Icon name="medication" /><View style={s.cardInfo}><Text style={s.medicationName}>{item.name}</Text><Text style={s.medicationDescription}>{item.dosage} · {item.schedule || 'No exact times saved'}{item.description ? ` · ${item.description}` : ''}</Text></View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.pinned ? 'Unpin' : 'Pin'} ${item.name}`} accessibilityState={{ selected: item.pinned, disabled: busy }}
                disabled={busy} onPress={() => void pin(item)} style={({ pressed }) => [s.pin, item.pinned && s.pinned, pressed && s.pressed]}><Icon name="pin" /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name} details`} hitSlop={8} onPress={() => open({ kind: 'detail', item })}><Icon name="chevron" /></Pressable>
            </View>)}
            {!filtered.length && !error && <View style={s.empty}><Text style={s.medicationName}>{query.trim() ? 'No medications found' : 'No saved medications yet'}</Text>
              <Text style={s.muted}>{query.trim() ? 'Try another name, dosage, or schedule.' : 'Add your first medication to get started.'}</Text>
              {!!query.trim() && <Pressable accessibilityRole="button" onPress={() => setQuery('')}><Text style={s.link}>Clear search</Text></Pressable>}
            </View>}
          </View>}
        <Pressable accessibilityRole="button" disabled={loading || busy || !!error} onPress={() => { setEditingMedication(null); setAdding(true); setFlowError(''); }}
          style={({ pressed }) => [s.addButton, pressed && s.pressed, (loading || busy || !!error) && s.disabled]}><Icon name="plus" /><Text style={s.buttonText}>Add medication</Text></Pressable>
        <Text style={s.disclaimer}>{disclaimer}</Text>
      </ScrollView>
      </>}
      <View style={s.navigation}><View style={s.navigationDivider} /><View style={s.tabs}>
        {([{ title: 'Home', icon: 'home' }, { title: 'Food interactions', icon: 'search' }, { title: 'Calendar', icon: 'calendar' }] as { title: string; icon: IconName }[]).map(tab =>
          <Pressable key={tab.title} accessibilityRole="tab" accessibilityLabel={tab.title} accessibilityState={{ selected: tab.title === 'Home' }}
            onPress={() => {
              if (tab.title === 'Home') { setQuery(''); setAdding(false); }
              else if (tab.title === 'Calendar') { trackFirst('click_calendar_tab'); setAdding(false); router.push('/calendar'); }
              else router.push('/food-interactions');
            }}
            style={({ pressed }) => [s.tab, tab.title === 'Home' && s.activeTab, pressed && s.pressed]}>
            <Icon name={tab.icon} /><Text style={[s.tabText, tab.title === 'Home' && s.activeTabText]}>{tab.title}</Text>
          </Pressable>)}
      </View>{web ? <View style={s.homeIndicatorArea}><View style={s.homeIndicator} /></View> : <View style={{ height: Math.max(insets.bottom, 8) }} />}</View>
    </View>
    <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close dialog" accessibilityRole="button" />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]} accessibilityViewIsModal>
          <View style={s.sheetHeading}><Text role="heading" style={s.sheetTitle}>{sheet?.kind === 'detail' ? sheet.item.name : sheet?.title}</Text>
            <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close" style={s.close}><Text style={s.clear}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>
            {sheet?.kind === 'detail' && <>
              <View style={s.detailRow}><Text style={s.muted}>Dosage</Text><Text style={s.medicationName}>{sheet.item.dosage}</Text></View>
              <View style={s.detailRow}><Text style={s.muted}>Schedule · exact times</Text><Text style={s.medicationName}>{sheet.item.schedule || 'No exact times saved'}</Text></View>
              <View style={s.detailRow}><Text style={s.muted}>Description</Text><Text style={s.medicationName}>{sheet.item.description || 'No description'}</Text></View>
              <Text style={s.disclaimer}>{disclaimer}</Text>
              {!!formError && <Text accessibilityRole="alert" style={s.errorText}>{formError}</Text>}
              {confirmRemove ? <><Text style={s.muted}>Remove {sheet.item.name} from your saved list?</Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void remove(sheet.item)} style={s.addButton}><Text style={s.errorText}>{busy ? 'Removing…' : 'Confirm removal'}</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmRemove(false)} style={s.cancel}><Text style={s.buttonText}>Keep medication</Text></Pressable>
              </> : <>
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${sheet.item.name}`} onPress={() => startEditing(sheet.item)} style={s.saveButton}>
                  <Text style={s.saveText}>Edit medication</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(true)} style={s.addButton}><Text style={s.buttonText}>Remove from saved medications</Text></Pressable>
              </>}
            </>}
            {sheet?.kind === 'soon' && <><Text style={s.medicationName}>Coming soon</Text><Text style={s.muted}>This first version includes your saved medications. {sheet.title} will be available in a future version.</Text><Pressable accessibilityRole="button" onPress={close} style={s.addButton}><Text style={s.buttonText}>Back to Home</Text></Pressable></>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
export default Home;
