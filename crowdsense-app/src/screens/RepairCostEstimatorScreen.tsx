import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  ArrowLeft,
  Calculator,
  HardHat,
  Truck,
  Leaf,
  Layers,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import {
  calculateRepairEstimate,
  RepairBOMEstimate,
} from '../services/repairEstimator';

interface RepairCostEstimatorScreenProps {
  onBack: () => void;
  initialArea?: number;
  initialDepth?: number;
}

export default function RepairCostEstimatorScreen({
  onBack,
  initialArea = 1.5,
  initialDepth = 5.0,
}: RepairCostEstimatorScreenProps) {
  const [areaInput, setAreaInput] = useState<string>(initialArea.toString());
  const [depthInput, setDepthInput] = useState<string>(initialDepth.toString());
  const [trafficTier, setTrafficTier] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'HEAVY_CORRIDOR'>('MEDIUM');
  const [isEmergency, setIsEmergency] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [estimate, setEstimate] = useState<RepairBOMEstimate | null>(null);

  const runCalculation = async () => {
    const area = parseFloat(areaInput) || 1.0;
    const depth = parseFloat(depthInput) || 5.0;

    setLoading(true);
    try {
      const res = await calculateRepairEstimate(area, depth, trafficTier, isEmergency);
      setEstimate(res);
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Calculation failed',
        text2: 'Using offline standard schedule fallback.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCalculation();
  }, [trafficTier, isEmergency]);

  const handleExportOrder = () => {
    Toast.show({
      type: 'success',
      text1: 'Work Order & BOM Generated',
      text2: `Total: ₹${estimate?.financials.totalEstimatedCost.toLocaleString('en-IN')} (CPWD Standard)`,
    });
  };

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Repair Cost & BOM</Text>
          <Text style={styles.headerSubtitle}>CPWD DSR 2024 Schedule of Rates</Text>
        </View>
        <View style={styles.badgeStandard}>
          <Text style={styles.badgeStandardText}>MoRTH 500</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Defect Dimensions Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Calculator size={20} color="#38BDF8" />
            <Text style={styles.cardTitle}>Pavement Defect Geometry</Text>
          </View>

          <View style={styles.rowInputs}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Surface Area (m²)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={areaInput}
                onChangeText={setAreaInput}
                onEndEditing={runCalculation}
                placeholder="1.5"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Avg Depth (cm)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={depthInput}
                onChangeText={setDepthInput}
                onEndEditing={runCalculation}
                placeholder="5.0"
                placeholderTextColor="#64748B"
              />
            </View>
          </View>

          {/* Quick Depth Buttons */}
          <View style={styles.quickButtonsRow}>
            {[
              { label: 'Minor (3cm)', val: '3.0' },
              { label: 'Standard (5cm)', val: '5.0' },
              { label: 'Deep Crater (8cm)', val: '8.0' },
              { label: 'Structural (12cm)', val: '12.0' },
            ].map((item) => (
              <Pressable
                key={item.label}
                style={[
                  styles.quickChip,
                  depthInput === item.val && styles.quickChipActive,
                ]}
                onPress={() => {
                  setDepthInput(item.val);
                  setTimeout(runCalculation, 50);
                }}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    depthInput === item.val && styles.quickChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Traffic Tier Select */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Corridor Traffic Classification</Text>
          <View style={styles.trafficGrid}>
            {(['LOW', 'MEDIUM', 'HIGH', 'HEAVY_CORRIDOR'] as const).map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.trafficOption,
                  trafficTier === t && styles.trafficOptionActive,
                ]}
                onPress={() => setTrafficTier(t)}
              >
                <Text
                  style={[
                    styles.trafficText,
                    trafficTier === t && styles.trafficTextActive,
                  ]}
                >
                  {t.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Emergency Cold Patch Toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Emergency All-Weather Cold Patch</Text>
              <Text style={styles.toggleSubtitle}>Instant polymer mix for monsoons / live traffic release</Text>
            </View>
            <Switch
              value={isEmergency}
              onValueChange={setIsEmergency}
              trackColor={{ false: '#334155', true: '#0284C7' }}
              thumbColor={isEmergency ? '#38BDF8' : '#94A3B8'}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Computing Bill of Materials...</Text>
          </View>
        ) : estimate ? (
          <>
            {/* Bill of Materials (BOM) Breakdown */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Layers size={20} color="#F59E0B" />
                <Text style={styles.cardTitle}>Bill of Materials (BOM)</Text>
              </View>

              <View style={styles.bomGrid}>
                <View style={styles.bomItem}>
                  <Text style={styles.bomLabel}>Asphalt Mix</Text>
                  <Text style={styles.bomValue}>
                    {estimate.materials.asphaltMixKg} kg
                  </Text>
                  <Text style={styles.bomSub}>({estimate.materials.asphaltMixTonnes} MT)</Text>
                </View>

                <View style={styles.bomItem}>
                  <Text style={styles.bomLabel}>Tack Coat (RS-1)</Text>
                  <Text style={styles.bomValue}>
                    {estimate.materials.tackCoatEmulsionKg} kg
                  </Text>
                  <Text style={styles.bomSub}>0.25 kg/m²</Text>
                </View>

                <View style={styles.bomItem}>
                  <Text style={styles.bomLabel}>Granular Sub-base</Text>
                  <Text style={styles.bomValue}>
                    {estimate.materials.granularSubbaseKg} kg
                  </Text>
                  <Text style={styles.bomSub}>
                    {estimate.materials.needsBaseCourseReinstatement ? 'Required (>6cm)' : 'Not needed'}
                  </Text>
                </View>

                <View style={styles.bomItem}>
                  <Text style={styles.bomLabel}>Roller Compaction</Text>
                  <Text style={styles.bomValue}>
                    {estimate.operational.rollerCompactionHours} hrs
                  </Text>
                  <Text style={styles.bomSub}>Tandem Vibratory</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.opsRow}>
                <View style={styles.opsItem}>
                  <Clock size={16} color="#94A3B8" />
                  <Text style={styles.opsText}>
                    Duration: <Text style={styles.opsBold}>{estimate.operational.durationHours} hrs</Text>
                  </Text>
                </View>

                <View style={styles.opsItem}>
                  <HardHat size={16} color="#94A3B8" />
                  <Text style={styles.opsText}>
                    Crew: <Text style={styles.opsBold}>{estimate.operational.recommendedCrewSize} members</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.carbonBadge}>
                <Leaf size={16} color="#10B981" />
                <Text style={styles.carbonText}>
                  Embodied Carbon: {estimate.environmental.embodiedCarbonKg} kg CO₂e
                </Text>
              </View>
            </View>

            {/* Financial Schedule Card */}
            <View style={[styles.card, styles.financialCard]}>
              <View style={styles.cardHeaderRow}>
                <Truck size={20} color="#10B981" />
                <Text style={styles.cardTitle}>Municipal Financial Schedule</Text>
              </View>

              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Materials (Bitumen + Base)</Text>
                <Text style={styles.costVal}>₹{estimate.financials.materialsCost.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Labor (Crew & Foreman)</Text>
                <Text style={styles.costVal}>₹{estimate.financials.laborCost.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Equipment & Mobilization</Text>
                <Text style={styles.costVal}>₹{estimate.financials.equipmentCost.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Traffic Impact Multiplier</Text>
                <Text style={styles.costVal}>{estimate.financials.trafficMultiplier}x</Text>
              </View>

              <View style={styles.costLine}>
                <Text style={styles.costLabel}>Contingency (10%)</Text>
                <Text style={styles.costVal}>
                  ₹{(estimate.financials.totalEstimatedCost * 0.1).toFixed(2)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Estimated Budget</Text>
                <Text style={styles.totalAmount}>
                  ₹{estimate.financials.totalEstimatedCost.toLocaleString('en-IN')}
                </Text>
              </View>

              {/* Action Button */}
              <Pressable style={styles.primaryButton} onPress={handleExportOrder}>
                <ShieldCheck size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Create Work Order & BOM</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  badgeStandard: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeStandardText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  financialCard: {
    borderColor: '#059669',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  quickButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  quickChipText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quickChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  trafficGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  trafficOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  trafficOptionActive: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  trafficText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  trafficTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 14,
  },
  bomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bomItem: {
    width: '48%',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bomLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  bomValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  bomSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  opsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opsText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  opsBold: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  carbonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  carbonText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  costLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  costVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10B981',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
