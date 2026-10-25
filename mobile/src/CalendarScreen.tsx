/**
 * CalendarScreen — implements the "Calendar · Medication & Food Timing" Figma section
 * (node 418-3868).
 * Supports all 3 interactive Figma states with full data synchronization:
 *   1. Default (418-3869) — full timeline view, nothing selected, selection details empty
 *   2. Medication selected (418-3998) — dose dot has selection ring, Medication details card below
 *   3. Food block selected (418-4135) — food avoidance block highlighted with #202020 border, Custom food rule details card below
 *
 * Fully dynamic: doses and food avoidance windows are calculated directly from each medication's
 * schedule string (e.g. "6:00 PM", "8:00 AM", multiple dose times, etc.).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { demoMode, Medication } from './medications';
import { Icon } from './icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64; // px per hour in timeline
const TIMELINE_LEFT = 64; // offset for the hour labels column

type Selection = 'dose' | 'food' | null;
const ALL_MEDICATIONS_ID = '__all_medications__';

type ScheduledDose = ParsedDose & { medication: Medication };

export interface ParsedDose {
  id: string;
  hour: number;        // 0 to 23
  minute: number;      // 0 to 59
  hourDecimal: number; // e.g. 18.0 for 6:00 PM
  displayTime: string; // "6:00 PM"
  intervalStr: string; // "6–8 PM"
  frequency: string;   // "Daily", "Mon, Wed, Fri", etc.
  days: string[];
}

interface Props {
  medications: Medication[];
  windowHeight: number;
  onBack: () => void;
}

const HOURS_LABELS = [
  '12:00 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM',
  '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
  '12:00 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
  '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
  '11:59 PM',
];

// Week days matching Figma mockup: M 20, T 21, W 22, T 23, F 24, S 25, S 26
const WEEK_DAYS_DATA = [
  { weekday: 'M', day: 20, dayKey: 'Mon', dateStr: 'Mon, October 20' },
  { weekday: 'T', day: 21, dayKey: 'Tue', dateStr: 'Tue, October 21' },
  { weekday: 'W', day: 22, dayKey: 'Wed', dateStr: 'Wed, October 22' },
  { weekday: 'T', day: 23, dayKey: 'Thu', dateStr: 'Thu, October 23' },
  { weekday: 'F', day: 24, dayKey: 'Fri', dateStr: 'Fri, October 24' },
  { weekday: 'S', day: 25, dayKey: 'Sat', dateStr: 'Sat, October 25' },
  { weekday: 'S', day: 26, dayKey: 'Sun', dateStr: 'Sun, October 26' },
];

// ─── Helpers: Schedule parsing ────────────────────────────────────────────────

function createDose(hour: number, minute: number, frequency = 'Daily', days: string[] = []): ParsedDose {
  const hourDecimal = hour + minute / 60;
  const dispHour = hour % 12 === 0 ? 12 : hour % 12;
  const dispMin = minute.toString().padStart(2, '0');
  const dispPeriod = hour >= 12 ? 'PM' : 'AM';
  const displayTime = `${dispHour}:${dispMin} ${dispPeriod}`;

  // 2-hour food avoidance window
  const endHourDecimal = (hourDecimal + 2) % 24;
  const endH = Math.floor(endHourDecimal);
  const endM = Math.round((endHourDecimal - endH) * 60);
  const endDispHour = endH % 12 === 0 ? 12 : endH % 12;
  const endDispMin = endM === 0 ? '' : `:${endM.toString().padStart(2, '0')}`;
  const endPeriod = endH >= 12 ? 'PM' : 'AM';

  const startMinStr = minute === 0 ? '' : `:${dispMin}`;
  const intervalStr = dispPeriod === endPeriod
    ? `${dispHour}${startMinStr}–${endDispHour}${endDispMin} ${dispPeriod}`
    : `${dispHour}${startMinStr} ${dispPeriod}–${endDispHour}${endDispMin} ${endPeriod}`;

  return {
    id: `dose-${hour}-${minute}`,
    hour,
    minute,
    hourDecimal,
    displayTime,
    intervalStr,
    frequency,
    days,
  };
}

export function parseScheduleTimes(schedule: string): ParsedDose[] {
  if (!schedule) return [];
  const results: ParsedDose[] = [];

  // 1. Match standard time expressions like "6:00 PM (Mon, Tue)", "6pm", "08:00 AM", etc.
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)(?:\s*\(([^)]*)\))?/gi;
  let match: RegExpExecArray | null;

  while ((match = timeRegex.exec(schedule)) !== null) {
    let rawHour = parseInt(match[1], 10);
    const rawMinute = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3].toUpperCase();

    if (period === 'PM' && rawHour !== 12) rawHour += 12;
    if (period === 'AM' && rawHour === 12) rawHour = 0;

    const hour = Math.min(23, Math.max(0, rawHour));
    const minute = Math.min(59, Math.max(0, rawMinute));

    const weekdayNames: Record<string, string> = {
      mon: 'Mon', monday: 'Mon', tue: 'Tue', tues: 'Tue', tuesday: 'Tue',
      wed: 'Wed', wednesday: 'Wed', thu: 'Thu', thur: 'Thu', thurs: 'Thu', thursday: 'Thu',
      fri: 'Fri', friday: 'Fri', sat: 'Sat', saturday: 'Sat', sun: 'Sun', sunday: 'Sun',
    };
    const rawDays = match[4] ? match[4].split(',').map(d => d.trim()) : [];
    const days = rawDays.map(day => weekdayNames[day.toLowerCase()]).filter((day): day is string => !!day);
    const frequency = days.length === 7 ? 'Daily'
      : days.length === 5 && !days.includes('Sat') && !days.includes('Sun') ? 'Weekdays'
      : days.length ? days.join(', ')
      : 'Daily';

    results.push(createDose(hour, minute, frequency, days));
  }

  if (results.length > 0) return results;

  // 2. 24-hour time e.g. "18:00"
  const time24Regex = /(\b[01]?\d|2[0-3]):([0-5]\d)\b/g;
  while ((match = time24Regex.exec(schedule)) !== null) {
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    results.push(createDose(hour, minute, 'Daily'));
  }
  if (results.length > 0) return results;

  // Timing words such as “morning” don't identify an exact time, so keep them
  // out of the timeline until the user saves an explicit time.
  return [];
}

export function getFoodRuleForMed(medication: Medication | null) {
  // The Figma sample is explicitly user-entered and only exists in local demo
  // data. Don't infer interaction rules from medication names.
  if (demoMode && medication?.id === 'demo-synthroid') {
    return { title: 'No soy', foodName: 'Soy foods', provenance: 'User-entered · Not medically verified' };
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarScreen({
  medications,
  windowHeight,
  onBack,
}: Props) {
  // Selected date index in week strip (defaults to Friday 24)
  const [selectedDayIdx, setSelectedDayIdx] = useState(4);
  const selectedDay = WEEK_DAYS_DATA[selectedDayIdx];

  // Medications list: use user's medications, or fallback to Synthroid demo if empty
  const allMeds = useMemo(() => {
    if (medications.length > 0) return medications;
    if (demoMode) return [
      {
        id: 'demo-synthroid',
        name: 'Synthroid',
        dosage: '100 mcg',
        schedule: '',
        description: 'Morning, empty stomach',
        pinned: false,
        created_at: new Date().toISOString(),
      },
    ];
    return [];
  }, [medications]);

  // Determine currently active medication
  // The calendar starts with every medication schedule visible.
  const [internalMedId, setInternalMedId] = useState<string>(ALL_MEDICATIONS_ID);
  const currentMed = useMemo(
    () => allMeds.find(m => m.id === internalMedId) ?? null,
    [allMeds, internalMedId],
  );

  // Keep medication metadata with each dose so all-schedules mode can label
  // markers and show the correct details when a user selects one.
  const doses = useMemo<ScheduledDose[]>(() => {
    const medsToShow = internalMedId === ALL_MEDICATIONS_ID
      ? allMeds
      : allMeds.filter(med => med.id === internalMedId);

    return medsToShow.flatMap(med => {
      const medicationDoses = parseScheduleTimes(med.schedule);
      return medicationDoses.map(dose => ({
        ...dose,
        id: `${med.id}:${dose.id}`,
        medication: med,
      }));
    });
  }, [allMeds, internalMedId]);

  const dosesForDay = useMemo(() => doses.filter(dose => (
    dose.days.length === 0 || dose.days.includes(selectedDay.dayKey)
  )), [doses, selectedDay.dayKey]);

  // Selection state: null (Default) | 'dose' (Medication selected) | 'food' (Food block selected)
  const [selection, setSelection] = useState<Selection>(null);

  // Active dose within the medication
  const [activeDoseId, setActiveDoseId] = useState<string>(() => doses[0]?.id || 'dose-0');

  const activeDose = useMemo(() => {
    return dosesForDay.find(d => d.id === activeDoseId) || dosesForDay[0];
  }, [dosesForDay, activeDoseId]);

  const foodRule = useMemo(
    () => currentMed ? getFoodRuleForMed(currentMed) : null,
    [currentMed],
  );
  const activeFoodRule = useMemo(
    () => activeDose ? getFoodRuleForMed(activeDose.medication) : null,
    [activeDose],
  );

  // Dropdown popover state for medication picker
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSelectMed = useCallback((id: string) => {
    setInternalMedId(id);
    setDropdownOpen(false);
    setSelection(null);
    setActiveDoseId('');
  }, []);

  const toggleDose = useCallback((doseId?: string) => {
    if (doseId) setActiveDoseId(doseId);
    setSelection(prev => {
      if (prev === 'dose' && (!doseId || activeDoseId === doseId)) return null;
      return 'dose';
    });
  }, [activeDoseId]);

  const toggleFood = useCallback((doseId?: string) => {
    if (doseId) setActiveDoseId(doseId);
    setSelection(prev => {
      if (prev === 'food' && (!doseId || activeDoseId === doseId)) return null;
      return 'food';
    });
  }, [activeDoseId]);

  const foodHeight = 2 * HOUR_HEIGHT; // 128px (2-hour avoidance window)

  // Dynamically size timeline viewport based on window height so everything fits on screen cleanly
  const timelineHeight = Math.min(288, Math.max(190, windowHeight - 510));

  return (
    <View style={s.container}>
      {/* App header */}
      <View style={s.appHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to medications"
          onPress={onBack}
          style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
          hitSlop={8}
        >
          <Icon name="calendarBack" />
        </Pressable>
        <Text style={s.headerTitle}>Calendar</Text>
      </View>

      <ScrollView
        style={s.bodyScroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Date heading */}
        <View style={s.dateHeading}>
          <Text style={s.currentDateText}>{selectedDay.dateStr}</Text>
          <View style={s.viewBadge}>
            <Text style={s.viewBadgeText}>Day</Text>
          </View>
        </View>

        {/* Week strip */}
        <View style={s.weekStrip} accessibilityRole="tablist" accessibilityLabel="Week calendar">
          {WEEK_DAYS_DATA.map((item, idx) => {
            const isSelected = idx === selectedDayIdx;
            return (
              <Pressable
                key={idx}
                accessibilityRole="tab"
                accessibilityLabel={`${item.weekday} ${item.day}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => { setSelectedDayIdx(idx); setSelection(null); }}
                style={[s.dayCell, isSelected && s.dayCellSelected]}
              >
                <Text style={s.weekdayText}>{item.weekday}</Text>
                <Text style={[s.dayNumText, isSelected && s.dayNumTextSelected]}>{item.day}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Medication filter dropdown pill row */}
        <View style={s.medPillRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Selected medication: ${currentMed?.name ?? 'All medications'}. Tap to choose another.`}
            onPress={() => setDropdownOpen(prev => !prev)}
            style={({ pressed }) => [s.medPill, pressed && s.pressed]}
          >
            <Text style={s.medPillText}>{currentMed?.name ?? 'All medications'}</Text>
            <Icon name="dropdown" />
          </Pressable>

        </View>

        {/* Dropdown Popover Menu (in-place, no Modal portal issues) */}
        {dropdownOpen && (
          <View style={s.popoverContainer}>
            <Text style={s.popoverTitle}>Select medication to view on calendar:</Text>
            <Pressable
              onPress={() => handleSelectMed(ALL_MEDICATIONS_ID)}
              style={({ pressed }) => [
                s.popoverItem,
                internalMedId === ALL_MEDICATIONS_ID && s.popoverItemSelected,
                pressed && s.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Show all medication schedules"
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.popoverItemName, internalMedId === ALL_MEDICATIONS_ID && s.popoverItemNameSelected]}>
                  All medications
                </Text>
                <Text style={s.popoverItemDetails}>Show every medication schedule</Text>
              </View>
              {internalMedId === ALL_MEDICATIONS_ID && <Text style={s.popoverItemCheck}>✓</Text>}
            </Pressable>
            {allMeds.map((med) => {
              const isSelected = med.id === internalMedId;
              const medDoses = parseScheduleTimes(med.schedule);
              const timesSummary = medDoses.map(d => d.displayTime).join(', ');

              return (
                <Pressable
                  key={med.id}
                  onPress={() => handleSelectMed(med.id)}
                  style={({ pressed }) => [
                    s.popoverItem,
                    isSelected && s.popoverItemSelected,
                    pressed && s.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${med.name}`}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.popoverItemName, isSelected && s.popoverItemNameSelected]}>
                      {med.name}
                    </Text>
                    <Text style={s.popoverItemDetails}>
                      {med.dosage}{timesSummary ? ` · ${timesSummary}` : ''}
                    </Text>
                  </View>
                  {isSelected && <Text style={s.popoverItemCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Example qualifier */}
        <Text style={s.exampleQualifier}>
          {internalMedId === ALL_MEDICATIONS_ID
            ? (dosesForDay.some(dose => getFoodRuleForMed(dose.medication)) ? 'All medication schedules · Custom rule' : dosesForDay.length ? 'All medication schedules' : doses.length ? 'No doses scheduled for this day' : 'Add a medication to view its schedule')
            : foodRule ? 'Example schedule · Custom rule' : currentMed?.name ? (dosesForDay.length ? 'Saved schedule' : doses.length ? 'No dose scheduled for this day' : 'No exact time saved for this schedule') : 'Add a medication to view its schedule'}
        </Text>

        {/* Timeline viewport */}
        <View style={[s.timelineViewport, { height: timelineHeight }]}>
          <ScrollView
            key={internalMedId}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            style={s.timelineScroll}
          >
            <View style={s.canvas}>
              {/* Hour rows & lines */}
              {HOURS_LABELS.map((label, idx) => {
                const y = idx * HOUR_HEIGHT;
                return (
                  <View key={label} style={[s.hourRow, { top: y }]}>
                    <Text style={s.hourLabel}>{label}</Text>
                    <View style={s.hourLine} />
                  </View>
                );
              })}

              {/* Render dose markers for every medication in the selected view */}
              {dosesForDay.map((dose) => {
                const doseY = dose.hourDecimal * HOUR_HEIGHT + 12;
                const isDoseSelected = selection === 'dose' && activeDose?.id === dose.id;
                const isFoodSelected = selection === 'food' && activeDose?.id === dose.id;
                const doseFoodRule = getFoodRuleForMed(dose.medication);

                return (
                  <React.Fragment key={dose.id}>
                    {/* Medication label at dose time */}
                    <Text
                      style={[s.medTimelineLabel, { top: doseY - 24 }]}
                      numberOfLines={1}
                    >
                      {dose.medication.name}
                    </Text>

                    {/* Dose marker hit area & visual elements at dose time */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${dose.medication.name} ${dose.displayTime} dose marker`}
                      accessibilityState={{ selected: isDoseSelected }}
                      onPress={() => toggleDose(dose.id)}
                      style={[s.doseHitArea, { top: doseY - 14 }]}
                    >
                      {isDoseSelected && <View style={s.selectedDoseRing}><Icon name="doseRing" /></View>}
                      <View style={s.dosePoint}><Icon name="dosePoint" /></View>
                      <View style={[s.doseLine, isDoseSelected && s.doseLineSelected]} />
                    </Pressable>

                    {/* Food avoidance block starting at dose time */}
                    {doseFoodRule && <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Food avoidance ${dose.intervalStr}, ${doseFoodRule.title}`}
                      accessibilityState={{ selected: isFoodSelected }}
                      onPress={() => toggleFood(dose.id)}
                      style={[
                        s.foodBlock,
                        { top: doseY, height: foodHeight },
                        isFoodSelected && s.foodBlockSelected,
                      ]}
                    >
                      <Text style={s.foodBlockTitle}>{doseFoodRule.title}</Text>
                      <Text style={s.foodBlockInterval}>{dose.intervalStr}</Text>
                    </Pressable>}
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Calendar Legend */}
        <View style={s.legendRow}>
          <View style={s.legendKey}>
            <View style={s.legendDoseLine} />
            <Text style={s.legendText}>Dose</Text>
          </View>
          <View style={s.legendKey}>
            <View style={s.legendFoodSwatch} />
            <Text style={s.legendText}>Avoid food</Text>
          </View>
        </View>

        {/* Selection Details Card (104px tall) */}
        <View style={s.selectionDetailsContainer}>
          {selection === 'dose' && activeDose && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Medication details card"
              onPress={() => toggleDose(activeDose.id)}
              style={s.detailCard}
            >
              <View style={s.detailCardRow}>
                <Text style={s.detailCardMedName}>{activeDose.medication.name}</Text>
                <Text style={s.detailCardDose}>{activeDose.medication.dosage}</Text>
              </View>
              <View style={s.detailCardRow}>
                <Text style={s.detailCardTime}>{activeDose.displayTime}</Text>
                <Text style={s.detailCardFreq}>{activeDose.frequency}</Text>
              </View>
            </Pressable>
          )}

          {selection === 'food' && activeDose && activeFoodRule && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Food restriction rule details card"
              onPress={() => toggleFood(activeDose.id)}
              style={[s.detailCard, { gap: 8 }]}
            >
              <View style={s.detailCardRow}>
                <Text style={s.detailCardMedName}>{activeFoodRule.foodName}</Text>
                <Text style={s.detailCardFoodInterval}>{activeDose.intervalStr}</Text>
              </View>
              <Text style={s.detailCardRuleText}>After {activeDose.medication.name} · 2 h</Text>
              <Text style={s.detailCardProvenanceText}>{activeFoodRule.provenance}</Text>
            </Pressable>
          )}

          {selection === null && (
            <View style={s.emptyDetailsSpace} />
          )}
        </View>

        {/* Verification note */}
        <Text style={s.verificationNote}>
          {selection === 'food' && activeFoodRule ? 'Unverified · confirm with pharmacist' : dosesForDay.length ? 'Times shown are from your saved schedule.' : 'Only saved exact times appear on the timeline.'}
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles matching Figma node 418-3868 ──────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pressed: {
    opacity: 0.6,
  },
  // App header: x: 0, y: 44, width: 402, height: 64
  appHeader: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#202020',
  },
  bodyScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  // Date heading: height 24, justify between
  dateHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
  },
  currentDateText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: '#202020',
  },
  viewBadge: {
    borderWidth: 1,
    borderColor: '#b8b8b8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewBadgeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#202020',
  },
  // Week strip: gap 6, height 44
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
    height: 44,
  },
  dayCell: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayCellSelected: {
    backgroundColor: '#e8e8e8',
    borderColor: '#202020',
  },
  weekdayText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#595959',
  },
  dayNumText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#202020',
  },
  dayNumTextSelected: {
    fontFamily: 'Inter_600SemiBold',
  },
  // Medication filter dropdown pill row: height 30, border #b8b8b8, rounded 8
  medPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
  },
  medPill: {
    borderWidth: 1,
    borderColor: '#b8b8b8',
    borderRadius: 8,
    height: 30,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  medPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#202020',
  },
  cycleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  cycleBtnText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#595959',
  },
  // In-place Popover Menu
  popoverContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#202020',
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  popoverTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#595959',
    marginBottom: 2,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  popoverItemSelected: {
    borderColor: '#202020',
    backgroundColor: '#f3f3f3',
  },
  popoverItemName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#202020',
  },
  popoverItemNameSelected: {
    fontFamily: 'Inter_700Bold',
  },
  popoverItemDetails: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#595959',
  },
  popoverItemCheck: {
    fontSize: 15,
    color: '#202020',
    fontWeight: 'bold',
  },
  // Qualifier
  exampleQualifier: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#595959',
  },
  // Timeline viewport: clips canvas
  timelineViewport: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timelineScroll: {
    flex: 1,
  },
  canvas: {
    width: '100%',
    height: 24 * HOUR_HEIGHT + 32,
    position: 'relative',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
  },
  hourLabel: {
    position: 'absolute',
    top: 5,
    width: 58,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: '#595959',
    textAlign: 'right',
    paddingRight: 6,
  },
  hourLine: {
    position: 'absolute',
    left: 64,
    right: 0,
    top: 12,
    height: 1,
    backgroundColor: '#e8e8e8',
  },
  medTimelineLabel: {
    position: 'absolute',
    left: 72,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#595959',
  },
  doseHitArea: {
    position: 'absolute',
    left: TIMELINE_LEFT - 1,
    height: 28,
    width: 124,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 4,
  },
  dosePoint: {
    position: 'absolute',
    left: 11,
    width: 8,
    height: 8,
    zIndex: 2,
  },
  doseLine: {
    position: 'absolute',
    left: 11,
    width: 106,
    height: 2,
    backgroundColor: '#202020',
  },
  doseLineSelected: {
    height: 4,
  },
  selectedDoseRing: {
    position: 'absolute',
    left: 5,
    top: 5,
    width: 18,
    height: 18,
    zIndex: 1,
  },
  foodBlock: {
    position: 'absolute',
    left: 194,
    width: 160,
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#b8b8b8',
    borderRadius: 4,
    padding: 12,
    gap: 6,
    zIndex: 3,
  },
  foodBlockSelected: {
    borderWidth: 1.5,
    borderColor: '#202020',
  },
  foodBlockTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#202020',
  },
  foodBlockInterval: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#595959',
  },
  // Calendar legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    height: 16,
  },
  legendKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDoseLine: {
    width: 20,
    height: 2,
    backgroundColor: '#202020',
    borderRadius: 1,
  },
  legendFoodSwatch: {
    width: 20,
    height: 12,
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#b8b8b8',
    borderRadius: 2,
  },
  legendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#595959',
  },
  // Selection details card: height 104, border 1px #202020, rounded 12, padding 14
  selectionDetailsContainer: {
    height: 104,
    justifyContent: 'center',
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 12,
    padding: 14,
    height: 104,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  detailCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailCardMedName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#202020',
  },
  detailCardDose: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#595959',
  },
  detailCardTime: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#202020',
  },
  detailCardFreq: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#595959',
  },
  detailCardFoodInterval: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#202020',
  },
  detailCardRuleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#202020',
  },
  detailCardProvenanceText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#595959',
  },
  emptyDetailsSpace: {
    height: 104,
  },
  // Verification note
  verificationNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#595959',
  },
});
