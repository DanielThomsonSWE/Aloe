import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../icons';
import { customInteractions, CustomInteraction, WaitUnit } from '../customInteractions';
import { exampleInteractions } from '../exampleInteractions';
import { styles as app } from '../styles';

type Page = 'list' | 'interactionDetails' | 'details' | 'timing' | 'review' | 'saved';
type Example = {
  id: string;
  food: string;
  drug: string;
  dose: string;
  effect: string;
  detail: string;
  source: string;
};
type DeleteTarget = { kind: 'custom'; item: CustomInteraction } | { kind: 'example'; item: Example };

// Reference examples are illustrative summaries of public prescribing labels.
const examples: Example[] = [
  {
    id: 'alcohol-metformin', food: 'Alcohol', drug: 'Metformin', dose: '500 mg',
    effect: 'Excess alcohol may raise the risk of lactic acidosis.',
    detail: 'Metformin prescribing information warns that excessive alcohol intake is a risk factor for lactic acidosis.',
    source: 'DailyMed · Metformin prescribing information',
  },
  {
    id: 'potassium-lisinopril', food: 'Potassium salt substitutes', drug: 'Lisinopril', dose: '10 mg',
    effect: 'May raise blood potassium.',
    detail: 'Lisinopril prescribing information cautions that potassium-containing salt substitutes may increase serum potassium.',
    source: 'DailyMed · Lisinopril prescribing information',
  },
];

const medicalNote = 'Example information, not personal medical advice. Check your medication’s instructions with your pharmacist.';
const userEntryNote = 'Custom entries are for your own reference, stay on this device, and are not medically verified.';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Could not save this entry. Please try again.';
const waitSentence = (amount: string, unit: WaitUnit, drug: string, food: string) => {
  const number = Number(amount) || 0;
  const unitLabel = number === 1 ? unit.slice(0, -1) : unit;
  return `Wait ${amount || '0'} ${unitLabel} after taking ${drug || 'the medication'} before eating ${food || 'the food'}.`;
};

function AppHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.appHeader}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
      <Icon name="calendarBack" />
    </Pressable>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>;
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return <View style={styles.stepRow}>
    <Text style={styles.stepLabel}>Custom entry · Step {step} of 3</Text>
    <View style={styles.progress}>
      {[1, 2, 3].map(index => <View key={index} style={[styles.progressBar, index <= step && styles.progressActive]} />)}
    </View>
  </View>;
}

function FoodCard({ item, onPress }: { item: Example; onPress: () => void }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${item.food} and ${item.drug}, ${item.dose}. ${item.effect}`}
    onPress={onPress}
    style={({ pressed }) => [styles.exampleCard, pressed && app.pressed]}
  >
    <View style={styles.cardCopy}>
      <Text style={styles.foodName}>{item.food}</Text>
      <Text style={styles.drugName}>{item.drug} · {item.dose}</Text>
      <Text style={styles.effect}>{item.effect}</Text>
    </View>
    <Icon name="chevron" />
  </Pressable>;
}

export default function FoodInteractionsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  const desktop = web && width >= 600;
  const [page, setPage] = useState<Page>('list');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<CustomInteraction[]>([]);
  const [removedExampleIds, setRemovedExampleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedExample, setSelectedExample] = useState<Example | null>(null);
  const [selectedCustom, setSelectedCustom] = useState<CustomInteraction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState<{ food: string; drug: string; kind: DeleteTarget['kind'] } | null>(null);

  const [foodName, setFoodName] = useState('Soy foods');
  const [drugName, setDrugName] = useState('Synthroid');
  const [waitAmount, setWaitAmount] = useState('4');
  const [waitUnit, setWaitUnit] = useState<WaitUnit>('hours');
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [notes, setNotes] = useState('Sample entry; ask pharmacist to confirm.');

  useEffect(() => {
    let active = true;
    void Promise.all([customInteractions.list(), exampleInteractions.removedIds()]).then(([items, removedIds]) => {
      if (active) { setSaved(items); setRemovedExampleIds(removedIds); }
    }).catch(cause => {
      if (active) setError(errorText(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredExamples = useMemo(() => examples.filter(item =>
    !removedExampleIds.includes(item.id) && `${item.food} ${item.drug} ${item.dose} ${item.effect}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [query, removedExampleIds]);
  const filteredCustom = useMemo(() => saved.filter(item =>
    `${item.foodName} ${item.drugName} ${item.note}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [query, saved]);
  const deleteFood = deleteTarget ? deleteTarget.kind === 'custom' ? deleteTarget.item.foodName : deleteTarget.item.food : '';
  const deleteDrug = deleteTarget ? deleteTarget.kind === 'custom' ? deleteTarget.item.drugName : `${deleteTarget.item.drug} · ${deleteTarget.item.dose}` : '';
  const deleteExplanation = deleteTarget?.kind === 'example'
    ? 'This removes the example from Food interactions on this device. It will not change your saved medications.'
    : deleteTarget?.kind === 'custom'
      ? `This removes the saved interaction and its timing rule. Your ${deleteTarget.item.drugName} medication will not be deleted.`
      : '';

  const resetDraft = () => {
    setFoodName('Soy foods'); setDrugName('Synthroid'); setWaitAmount('4');
    setWaitUnit('hours'); setNotes('Sample entry; ask pharmacist to confirm.'); setError('');
  };
  const startCustom = () => { resetDraft(); setSelectedCustom(null); setDeletedNotice(null); setPage('details'); };
  const goToTab = (tab: 'Home' | 'Food interactions' | 'Calendar') => {
    if (tab === 'Home') router.replace('/');
    else if (tab === 'Calendar') router.replace('/calendar');
    else { setPage('list'); setSelectedExample(null); setSelectedCustom(null); setDeleteTarget(null); }
  };
  const deleteSelectedInteraction = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setError('');
    try {
      if (deleteTarget.kind === 'custom') {
        await customInteractions.remove(deleteTarget.item.id);
        setSaved(current => current.filter(item => item.id !== deleteTarget.item.id));
      } else {
        await exampleInteractions.remove(deleteTarget.item.id);
        setRemovedExampleIds(current => current.includes(deleteTarget.item.id) ? current : [...current, deleteTarget.item.id]);
      }
      const food = deleteTarget.kind === 'custom' ? deleteTarget.item.foodName : deleteTarget.item.food;
      const drug = deleteTarget.kind === 'custom' ? deleteTarget.item.drugName : deleteTarget.item.drug;
      setDeletedNotice({ food, drug, kind: deleteTarget.kind });
      setSelectedCustom(null); setSelectedExample(null); setDeleteTarget(null); setPage('list'); setQuery('');
    } catch (cause) { setError(errorText(cause)); }
    finally { setDeleting(false); }
  };
  const saveCustom = async () => {
    const amount = Number(waitAmount);
    if (!foodName.trim() || !drugName.trim()) { setError('Enter both a food and medication name.'); setPage('details'); return; }
    if (!Number.isFinite(amount) || amount < 1 || amount > 365) { setError('Enter a wait interval from 1 to 365.'); setPage('timing'); return; }
    setSaving(true); setError('');
    try {
      const item = await customInteractions.add({
        foodName: foodName.trim(), drugName: drugName.trim(), waitAmount: amount, waitUnit, note: notes.trim(),
      });
      setSaved(current => [item, ...current]);
      setPage('saved');
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  };

  const tabs: { title: 'Home' | 'Food interactions' | 'Calendar'; icon: IconName }[] = [
    { title: 'Home', icon: 'home' }, { title: 'Food interactions', icon: 'search' }, { title: 'Calendar', icon: 'calendar' },
  ];

  return <View style={[app.stage, desktop && app.desktopStage]}>
    <StatusBar style="dark" />
    <View testID="phone" style={[
      app.phone,
      desktop && { width: 400, height: Math.min(height - 48, 876), flex: 0, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 40 },
      web && !desktop && { borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 40 },
    ]}>
      {web ? <View style={app.status} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={app.statusTime}>9:41</Text><View style={app.deviceStatus}><Icon name="signal" /><Icon name="wifi" /><Icon name="battery" /></View>
      </View> : <View style={{ height: insets.top }} />}

      {page === 'list' ? <>
        <View style={app.header}><Icon name="brand" /><Text style={app.brand}>Aloe</Text></View>
        <ScrollView style={[app.scroll, { minHeight: 0 }]} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text role="heading" style={styles.pageTitle}>Food interactions</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Add custom interaction" onPress={startCustom} style={styles.addIconButton}><Icon name="plus" /></Pressable>
          </View>
          <View style={styles.searchBox}>
            <Icon name="search" />
            <TextInput accessibilityLabel="Search foods or drinks" value={query} onChangeText={setQuery} placeholder="Search foods or drinks" placeholderTextColor="#595959" style={styles.searchInput} returnKeyType="search" />
            {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Text style={app.clear}>×</Text></Pressable>}
          </View>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <View style={styles.exampleList}>
            <Text style={styles.sectionCaption}>{filteredExamples.length} food and drink examples</Text>
            {filteredExamples.map(item => <FoodCard key={item.id} item={item} onPress={() => setSelectedExample(item)} />)}
            {!filteredExamples.length && !filteredCustom.length && <Text style={app.muted}>{query.trim() ? 'No matching interactions. Try another search.' : 'No examples or custom interactions are available.'}</Text>}
          </View>
          {filteredCustom.length > 0 && <View style={styles.exampleList}>
            <Text style={styles.sectionCaption}>Your custom entries · Not medically verified</Text>
            {filteredCustom.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`View custom interaction: ${item.foodName} and ${item.drugName}`} onPress={() => { setSelectedCustom(item); setError(''); setPage('interactionDetails'); }} style={({ pressed }) => [styles.exampleCard, pressed && app.pressed]}>
              <View style={styles.cardCopy}><Text style={styles.foodName}>{item.foodName}</Text><Text style={styles.drugName}>{item.drugName} · Custom entry</Text><Text style={styles.effect}>{waitSentence(String(item.waitAmount), item.waitUnit, item.drugName, item.foodName)}</Text></View>
              <Icon name="chevron" />
            </Pressable>)}
          </View>}
          {loading && <View style={styles.loading}><ActivityIndicator color="#202020" /><Text style={app.muted}>Loading custom entries…</Text></View>}
          <Text style={styles.disclaimer}>{medicalNote}</Text>
          {deletedNotice && <View style={styles.deletedNotice} accessibilityRole="alert">
            <Text style={styles.deletedTitle}>{deletedNotice.kind === 'example' ? 'Example deleted' : 'Interaction deleted'}</Text>
            <Text style={styles.deletedText}>{deletedNotice.kind === 'example'
              ? `${deletedNotice.food} / ${deletedNotice.drug} example removed from this device. Your saved medications are unchanged.`
              : `${deletedNotice.food} / ${deletedNotice.drug} removed. Your ${deletedNotice.drug} medication has not been deleted.`}</Text>
          </View>}
        </ScrollView>
      </> : page === 'interactionDetails' && selectedCustom ? <>
        <AppHeader title="Saved interaction" onBack={() => { setSelectedCustom(null); setError(''); setPage('list'); }} />
        <ScrollView style={styles.flowScroll} contentContainerStyle={styles.interactionContent}>
          <Text role="heading" style={styles.flowTitle}>Interaction details</Text>
          <Text style={styles.reviewStatus}>User-entered · Not medically verified</Text>
          <View style={styles.reviewGroup}>
            <Text style={styles.groupTitle}>Food and medication</Text>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Food</Text><Text style={styles.detailValue}>{selectedCustom.foodName}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Drug</Text><Text style={styles.detailValue}>{selectedCustom.drugName}</Text></View>
          </View>
          <View style={styles.reviewGroup}>
            <Text style={styles.groupTitle}>Your timing rule</Text>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Wait interval</Text><Text style={styles.detailValue}>{selectedCustom.waitAmount} {selectedCustom.waitUnit}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Order</Text><Text style={styles.detailValue}>Medication first, then food</Text></View>
            <Text style={styles.previewText}>{waitSentence(String(selectedCustom.waitAmount), selectedCustom.waitUnit, selectedCustom.drugName, selectedCustom.foodName)}</Text>
          </View>
          <View style={styles.reviewGroup}>
            <Text style={styles.groupTitle}>Source / notes</Text>
            <Text style={styles.reviewNote}>{selectedCustom.note || 'No notes added.'}</Text>
          </View>
          <Text style={styles.smallDisclaimer}>Example custom rule, not a verified safe interval. Confirm timing with a pharmacist. Do not change medication directions based on this entry.</Text>
          <Pressable accessibilityRole="button" onPress={() => { setError(''); setDeleteTarget({ kind: 'custom', item: selectedCustom }); }} style={styles.deleteEntryButton}><Text style={styles.deleteEntryText}>Delete interaction</Text></Pressable>
          <Text style={styles.disclaimer}>Deletes this saved interaction only, not your medication.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </ScrollView>
      </> : <>
        <AppHeader title={page === 'saved' ? 'Saved interaction' : 'Add custom interaction'} onBack={() => {
          setError('');
          if (page === 'details') setPage('list');
          else if (page === 'timing') setPage('details');
          else if (page === 'review') setPage('timing');
          else setPage('list');
        }} />

        {page === 'details' && <ScrollView style={styles.flowScroll} contentContainerStyle={styles.flowContent} keyboardShouldPersistTaps="handled">
          <StepIndicator step={1} />
          <Text style={styles.flowTitle}>Enter food and medication</Text>
          <Text style={styles.supporting}>Create a custom food–drug entry for your own reference. Add the names, then enter a timing rule.</Text>
          <View style={styles.formFields}>
            <View style={styles.formField}><Text style={styles.fieldLabel}>Food name</Text><TextInput accessibilityLabel="Food name" value={foodName} onChangeText={setFoodName} style={styles.input} maxLength={80} /></View>
            <View style={styles.formField}><Text style={styles.fieldLabel}>Drug name</Text><TextInput accessibilityLabel="Drug name" value={drugName} onChangeText={setDrugName} style={styles.input} maxLength={80} /></View>
          </View>
          <Text style={styles.disclaimer}>{userEntryNote}</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" onPress={() => { if (!foodName.trim() || !drugName.trim()) setError('Enter both a food and medication name.'); else { setError(''); setPage('timing'); } }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Continue</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setError(''); setPage('list'); }} style={styles.textAction}><Text style={styles.underlined}>Cancel</Text></Pressable>
        </ScrollView>}

        {page === 'timing' && <ScrollView style={styles.flowScroll} contentContainerStyle={styles.flowContent} keyboardShouldPersistTaps="handled">
          <StepIndicator step={2} />
          <Text style={styles.flowTitle}>Set timing</Text>
          <Text style={styles.pairSummary}>{foodName.trim() || 'Food'} + {drugName.trim() || 'Medication'}</Text>
          <Text style={styles.direction}>After taking the medication, wait before eating the food</Text>
          <View style={styles.waitRow}>
            <View style={[styles.formField, { flex: 1 }]}><Text style={styles.fieldLabel}>Wait interval</Text><TextInput accessibilityLabel="Wait interval" value={waitAmount} onChangeText={value => { setWaitAmount(value.replace(/[^0-9]/g, '').slice(0, 3)); setError(''); }} keyboardType="number-pad" style={styles.input} maxLength={3} /></View>
            <View style={[styles.formField, { flex: 1 }]}><Text style={styles.fieldLabel}>Unit</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Unit ${waitUnit}. Change unit`} accessibilityHint="Opens hours and days choices" onPress={() => setUnitMenuOpen(value => !value)} style={[styles.input, styles.unitButton]}><Text style={styles.inputText}>{waitUnit}</Text><Icon name="dropdown" /></Pressable>
              {unitMenuOpen && <View style={styles.unitMenu}>{(['hours', 'days'] as WaitUnit[]).map(unit => <Pressable key={unit} accessibilityRole="button" accessibilityState={{ selected: unit === waitUnit }} onPress={() => { setWaitUnit(unit); setUnitMenuOpen(false); }} style={styles.unitOption}><Text style={styles.inputText}>{unit}</Text></Pressable>)}</View>}
            </View>
          </View>
          <View style={styles.formField}><Text style={styles.fieldLabel}>Source / notes (optional)</Text><TextInput accessibilityLabel="Source or notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={200} style={[styles.input, styles.notesInput]} /></View>
          <View style={styles.rulePreview}><Text style={styles.previewLabel}>Your rule · Example only</Text><Text style={styles.previewText}>{waitSentence(waitAmount, waitUnit, drugName, foodName)}</Text></View>
          <Text style={styles.smallDisclaimer}>Example custom rule, not a verified safe interval. Confirm timing with a pharmacist. Do not change medication directions based on this entry.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" onPress={() => { const value = Number(waitAmount); if (!Number.isFinite(value) || value < 1 || value > 365) setError('Enter a wait interval from 1 to 365.'); else { setError(''); setPage('review'); } }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Continue</Text></Pressable>
        </ScrollView>}

        {page === 'review' && <ScrollView style={styles.flowScroll} contentContainerStyle={styles.flowContent} keyboardShouldPersistTaps="handled">
          <StepIndicator step={3} />
          <Text style={styles.flowTitle}>Review interaction</Text>
          <Text style={styles.reviewStatus}>User-entered · Not medically verified</Text>
          <View style={styles.reviewGroup}>
            <View style={styles.groupHeading}><Text style={styles.groupTitle}>Food and medication</Text><Pressable accessibilityRole="button" onPress={() => setPage('details')}><Text style={styles.editLink}>Edit</Text></Pressable></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Food</Text><Text style={styles.detailValue}>{foodName}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Drug</Text><Text style={styles.detailValue}>{drugName}</Text></View>
          </View>
          <View style={styles.reviewGroup}>
            <View style={styles.groupHeading}><Text style={styles.groupTitle}>Your timing rule</Text><Pressable accessibilityRole="button" onPress={() => setPage('timing')}><Text style={styles.editLink}>Edit</Text></Pressable></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Wait interval</Text><Text style={styles.detailValue}>{waitAmount} {waitUnit}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Order</Text><Text style={styles.detailValue}>Medication first, then food</Text></View>
            <Text style={styles.previewText}>{waitSentence(waitAmount, waitUnit, drugName, foodName)}</Text>
          </View>
          <View style={styles.reviewGroup}>
            <View style={styles.groupHeading}><Text style={styles.groupTitle}>Source / notes</Text><Pressable accessibilityRole="button" onPress={() => setPage('timing')}><Text style={styles.editLink}>Edit</Text></Pressable></View>
            <Text style={styles.reviewNote}>{notes.trim() || 'No notes added.'}</Text>
          </View>
          <Text style={styles.smallDisclaimer}>Example custom rule, not a verified safe interval. Confirm timing with a pharmacist. Do not change medication directions based on this entry.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveCustom()} style={[styles.primaryButton, saving && app.disabled]}>{saving ? <ActivityIndicator color="#202020" /> : <Text style={styles.primaryButtonText}>Save interaction</Text>}</Pressable>
        </ScrollView>}

        {page === 'saved' && <ScrollView style={styles.flowScroll} contentContainerStyle={styles.savedContent}>
          <Text style={styles.flowTitle}>Interaction saved</Text>
          <Text style={styles.supporting}>Saved to your custom entries on this device, separate from Aloe’s interaction information.</Text>
          <Text style={styles.reviewStatus}>User-entered · Not medically verified</Text>
          <View style={styles.reviewGroup}>
            <View style={styles.groupHeading}><Text style={styles.groupTitle}>Food and medication</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Food</Text><Text style={styles.detailValue}>{foodName}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Drug</Text><Text style={styles.detailValue}>{drugName}</Text></View>
          </View>
          <View style={styles.rulePreview}><Text style={styles.previewLabel}>Your rule · Example only</Text><Text style={styles.previewText}>{waitSentence(waitAmount, waitUnit, drugName, foodName)}</Text></View>
          <View style={styles.reviewGroup}><View style={styles.groupHeading}><Text style={styles.groupTitle}>Source / notes</Text></View><Text style={styles.reviewNote}>{notes.trim() || 'No notes added.'}</Text></View>
          <Text style={styles.smallDisclaimer}>Example custom rule, not a verified safe interval. Confirm timing with a pharmacist. Do not change medication directions based on this entry.</Text>
          <Pressable accessibilityRole="button" onPress={() => { setQuery(''); setPage('list'); }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={startCustom} style={styles.textAction}><Text style={styles.underlined}>Add another interaction</Text></Pressable>
        </ScrollView>}
      </>}

      <View style={app.navigation}><View style={app.navigationDivider} /><View style={app.tabs}>
        {tabs.map(tab => { const selected = tab.title === 'Food interactions'; return <Pressable key={tab.title} accessibilityRole="tab" accessibilityLabel={tab.title} accessibilityState={{ selected }} onPress={() => goToTab(tab.title)} style={({ pressed }) => [app.tab, selected && app.activeTab, pressed && app.pressed]}><Icon name={tab.icon} /><Text style={[app.tabText, selected && app.activeTabText]}>{tab.title}</Text></Pressable>; })}
      </View>{web ? <View style={app.homeIndicatorArea}><View style={app.homeIndicator} /></View> : <View style={{ height: Math.max(insets.bottom, 8) }} />}</View>
    </View>

    <Modal visible={selectedExample !== null} transparent animationType="fade" onRequestClose={() => setSelectedExample(null)}>
      <View style={app.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close interaction details" onPress={() => setSelectedExample(null)} />
        <View style={[app.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]} accessibilityViewIsModal>
          <View style={app.sheetHeading}><Text style={app.sheetTitle}>{selectedExample?.food}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" style={app.close} onPress={() => setSelectedExample(null)}><Text style={app.clear}>×</Text></Pressable></View>
          <View style={app.sheetContent}>
            <Text style={app.medicationName}>{selectedExample?.drug}{selectedExample?.dose && selectedExample.dose !== 'Custom entry' ? ` · ${selectedExample.dose}` : ''}</Text>
            <Text style={styles.previewText}>{selectedExample?.detail}</Text>
            {!!selectedExample?.source && <Text style={app.muted}>{selectedExample.source}</Text>}
            <Text style={app.disclaimer}>{selectedExample?.id.startsWith('custom-') ? 'User-entered information; not medically verified.' : medicalNote}</Text>
            <Pressable accessibilityRole="button" onPress={() => {
              if (selectedExample) { setError(''); setDeleteTarget({ kind: 'example', item: selectedExample }); }
            }} style={styles.deleteExampleButton}><Text style={styles.deleteExampleText}>Delete example</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSelectedExample(null)} style={app.addButton}><Text style={app.buttonText}>Close</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteTarget(null); }}>
      <View style={styles.deleteModalRoot}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cancel deletion" onPress={() => { if (!deleting) setDeleteTarget(null); }} />
        <View style={styles.deleteDialog} accessibilityViewIsModal>
          <Text style={styles.deleteTitle}>{deleteTarget?.kind === 'example' ? 'Delete this example?' : 'Delete this interaction?'}</Text>
          <View style={styles.deleteSummary}>
            <Text style={styles.deleteFood}>{deleteFood}</Text>
            <Text style={styles.deleteDrug}>{deleteDrug}</Text>
          </View>
          <Text style={styles.deleteExplanation}>{deleteExplanation}</Text>
          <Text style={styles.deleteIrreversible}>This action cannot be undone.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => void deleteSelectedInteraction()} style={[styles.confirmDeleteButton, deleting && app.disabled]}>
            {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmDeleteText}>{deleteTarget?.kind === 'example' ? 'Delete example' : 'Delete interaction'}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteTarget(null)} style={[styles.cancelDeleteButton, deleting && app.disabled]}><Text style={styles.cancelDeleteText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  appHeader: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#202020' },
  listContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 16 },
  titleRow: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageTitle: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, color: '#202020' },
  addIconButton: { width: 44, height: 44, borderWidth: 1.5, borderColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 50, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: '100%', minWidth: 0, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#202020', padding: 0, outlineWidth: 0 },
  exampleList: { gap: 10 },
  sectionCaption: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#595959' },
  exampleCard: { minHeight: 84, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardCopy: { flex: 1, gap: 6 },
  foodName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  drugName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  effect: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#595959' },
  disclaimer: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, color: '#595959' },
  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  flowScroll: { flex: 1, minHeight: 0 },
  flowContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20, gap: 12 },
  savedContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 12 },
  interactionContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 15 },
  stepLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#595959' },
  progress: { flexDirection: 'row', gap: 5 },
  progressBar: { width: 20, height: 3, borderRadius: 2, backgroundColor: '#e0e0e0' },
  progressActive: { backgroundColor: '#202020' },
  flowTitle: { fontFamily: 'Outfit_700Bold', fontSize: 28, lineHeight: 32, color: '#202020' },
  supporting: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: '#595959' },
  formFields: { gap: 16, paddingVertical: 4 },
  formField: { gap: 8, position: 'relative' },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 15, color: '#202020', backgroundColor: '#fff' },
  inputText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: '#202020' },
  primaryButton: { minHeight: 52, borderWidth: 1.5, borderColor: '#202020', borderRadius: 8, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  textAction: { alignItems: 'center', justifyContent: 'center', minHeight: 24 },
  underlined: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#202020', textDecorationLine: 'underline' },
  pairSummary: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  direction: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#202020' },
  waitRow: { flexDirection: 'row', gap: 12 },
  unitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitMenu: { position: 'absolute', zIndex: 5, top: 76, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  unitOption: { height: 44, justifyContent: 'center', paddingHorizontal: 14 },
  notesInput: { minHeight: 54, paddingTop: 10, textAlignVertical: 'top', fontSize: 13 },
  rulePreview: { backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, padding: 12, gap: 5 },
  previewLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#595959' },
  previewText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#202020' },
  smallDisclaimer: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, color: '#595959' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#9d2626' },
  reviewStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  reviewGroup: { borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 12, padding: 14, gap: 10 },
  groupHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  editLink: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#202020', textDecorationLine: 'underline' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailLabel: { width: 90, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#595959' },
  detailValue: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#202020' },
  reviewNote: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#595959' },
  deleteEntryButton: { minHeight: 52, borderWidth: 1.5, borderColor: '#202020', borderRadius: 8, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  deleteEntryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  deleteExampleButton: { height: 52, borderWidth: 1.5, borderColor: '#202020', borderRadius: 8, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },
  deleteExampleText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  deletedNotice: { backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, padding: 12, gap: 5 },
  deletedTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#202020' },
  deletedText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#595959' },
  deleteModalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  deleteDialog: { width: '100%', maxWidth: 354, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 12, padding: 20, gap: 16 },
  deleteTitle: { fontFamily: 'Outfit_700Bold', fontSize: 24, lineHeight: 28, color: '#202020' },
  deleteSummary: { backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#b8b8b8', borderRadius: 8, padding: 12, gap: 6 },
  deleteFood: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
  deleteDrug: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#202020' },
  deleteExplanation: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#595959' },
  deleteIrreversible: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: '#595959' },
  confirmDeleteButton: { height: 52, backgroundColor: '#202020', borderWidth: 1.5, borderColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  confirmDeleteText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' },
  cancelDeleteButton: { height: 52, backgroundColor: '#f3f3f3', borderWidth: 1.5, borderColor: '#202020', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelDeleteText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#202020' },
});
