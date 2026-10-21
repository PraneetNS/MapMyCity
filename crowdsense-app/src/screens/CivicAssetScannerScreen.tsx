import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  ArrowLeft,
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Shield,
  Layers,
  MapPin,
  Calendar,
  Building,
  Star,
  Send,
  Navigation,
} from 'lucide-react-native';
import {
  lookupAssetByQR,
  recordAssetInspection,
  fetchNearbyAssets,
  CivicAsset,
} from '../services/civicAssetService';

interface CivicAssetScannerScreenProps {
  onBack: () => void;
  onLinkDefectCluster?: (asset: CivicAsset) => void;
}

export default function CivicAssetScannerScreen({
  onBack,
  onLinkDefectCluster,
}: CivicAssetScannerScreenProps) {
  const [qrInput, setQrInput] = useState<string>('BLR-STLT-04921');
  const [loading, setLoading] = useState<boolean>(false);
  const [asset, setAsset] = useState<CivicAsset | null>(null);
  const [nearbyList, setNearbyList] = useState<CivicAsset[]>([]);
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false);

  // Inspection form
  const [rating, setRating] = useState<number>(4);
  const [defectNotes, setDefectNotes] = useState<string>('');
  const [submittingInspection, setSubmittingInspection] = useState<boolean>(false);

  useEffect(() => {
    handleLookup('BLR-STLT-04921');
    loadNearby();
  }, []);

  const loadNearby = async () => {
    setLoadingNearby(true);
    try {
      const list = await fetchNearbyAssets(12.971891, 77.641154, 2000);
      setNearbyList(list);
    } catch {
      // ignore
    } finally {
      setLoadingNearby(false);
    }
  };

  const handleLookup = async (codeToQuery?: string) => {
    const q = (codeToQuery || qrInput).trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await lookupAssetByQR(q);
      setAsset(res);
      Toast.show({
        type: 'success',
        text1: '✓ Civic Asset Verified',
        text2: `${res.asset_code} (${res.department})`,
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Asset Lookup Failed',
        text2: err?.message || 'Asset not found in municipal registry.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInspection = async () => {
    if (!asset) return;
    setSubmittingInspection(true);
    try {
      const res = await recordAssetInspection(
        asset.asset_code,
        rating,
        defectNotes.trim() || undefined,
        rating <= 2 ? 'Reported Critical Defect' : undefined
      );

      setAsset((prev) => (prev ? { ...prev, health_status: res.health_status as any } : null));
      setDefectNotes('');
      Toast.show({
        type: 'success',
        text1: '✓ Inspection Logged',
        text2: `Asset health updated to ${res.health_status}.`,
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Inspection Failed',
        text2: err?.message || 'Could not record inspection.',
      });
    } finally {
      setSubmittingInspection(false);
    }
  };

  const getHealthBadgeStyle = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return { bg: '#DCFCE7', text: '#15803D', label: 'OPERATIONAL' };
      case 'DEGRADED':
        return { bg: '#FEF3C7', text: '#B45309', label: 'DEGRADED' };
      case 'FAULTY':
        return { bg: '#FFEDD5', text: '#C2410C', label: 'FAULTY' };
      case 'HAZARDOUS':
        return { bg: '#FEE2E2', text: '#B91C1C', label: 'HAZARDOUS' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: status };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={20} color="#0F172A" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Civic Asset QR Inspector</Text>
          <Text style={styles.headerSubtitle}>Physical municipal infrastructure registry</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Scanner / Code Lookup Box */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <QrCode size={18} color="#4F46E5" />
            <Text style={styles.cardTitle}>Scan or Enter Asset Serial Tag</Text>
          </View>
          <Text style={styles.cardDesc}>
            Streetlights, manholes, transformers, and storm drains carry physical QR plates.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. BLR-STLT-04921 or scan URL"
              placeholderTextColor="#94A3B8"
              value={qrInput}
              onChangeText={setQrInput}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={() => handleLookup()}
              disabled={loading}
              style={[styles.searchBtn, loading && styles.btnDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Search size={16} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          {/* Quick Select Preset Pills */}
          <View style={styles.presetSection}>
            <Text style={styles.presetLabel}>Quick Presets:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              {['BLR-STLT-04921', 'BLR-MNH-01029', 'BLR-TRF-00318', 'BLR-DRN-00844'].map((code) => (
                <Pressable
                  key={code}
                  onPress={() => {
                    setQrInput(code);
                    handleLookup(code);
                  }}
                  style={styles.presetPill}
                >
                  <Text style={styles.presetPillText}>{code}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Verified Asset Profile Display */}
        {asset && (
          <View style={styles.assetCard}>
            <View style={styles.assetHeader}>
              <View>
                <Text style={styles.assetCodeText}>{asset.asset_code}</Text>
                <Text style={styles.assetTypeText}>
                  {asset.asset_type.toUpperCase().replace('_', ' ')}
                </Text>
              </View>
              {(() => {
                const b = getHealthBadgeStyle(asset.health_status);
                return (
                  <View style={[styles.healthBadge, { backgroundColor: b.bg }]}>
                    <Text style={[styles.healthBadgeText, { color: b.text }]}>{b.label}</Text>
                  </View>
                );
              })()}
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <MapPin size={15} color="#64748B" />
              <Text style={styles.metaText}>{asset.location_description}</Text>
            </View>
            <View style={styles.metaRow}>
              <Building size={15} color="#64748B" />
              <Text style={styles.metaText}>Department: {asset.department}</Text>
            </View>
            <View style={styles.metaRow}>
              <Calendar size={15} color="#64748B" />
              <Text style={styles.metaText}>
                Installed: {asset.installation_year} • Ward: {asset.ward_id}
              </Text>
            </View>

            {/* Inspection Form */}
            <View style={styles.inspectionBox}>
              <Text style={styles.inspectionTitle}>Record Citizen Field Condition</Text>
              <Text style={styles.inspectionDesc}>
                Help your ward engineer monitor hardware degradation.
              </Text>

              {/* Star Rating Selection */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable key={s} onPress={() => setRating(s)} style={styles.starBtn}>
                    <Star
                      size={24}
                      color={s <= rating ? '#F59E0B' : '#CBD5E1'}
                      fill={s <= rating ? '#F59E0B' : 'transparent'}
                    />
                  </Pressable>
                ))}
                <Text style={styles.ratingLabelText}>
                  {rating === 1
                    ? '1 - Hazardous'
                    : rating === 2
                    ? '2 - Faulty'
                    : rating === 3
                    ? '3 - Degraded'
                    : rating === 4
                    ? '4 - Good'
                    : '5 - Excellent'}
                </Text>
              </View>

              <TextInput
                style={styles.defectInput}
                placeholder="Observed notes (e.g. bulb burnt out, cracked cover, loose bolt)..."
                placeholderTextColor="#94A3B8"
                value={defectNotes}
                onChangeText={setDefectNotes}
                multiline
              />

              <Pressable
                onPress={handleSubmitInspection}
                disabled={submittingInspection}
                style={[styles.submitInspBtn, submittingInspection && styles.btnDisabled]}
              >
                {submittingInspection ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={15} color="#FFFFFF" />
                    <Text style={styles.submitInspBtnText}>Submit Condition Report</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Nearby Registered Assets in Ward */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Navigation size={18} color="#059669" />
            <Text style={styles.cardTitle}>Nearby Municipal Infrastructure</Text>
          </View>
          <Text style={styles.cardDesc}>
            Physical infrastructure registered within 2 km of your current GPS centroid.
          </Text>

          {loadingNearby ? (
            <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 12 }} />
          ) : nearbyList.length === 0 ? (
            <Text style={styles.emptyText}>No registered assets found in immediate perimeter.</Text>
          ) : (
            <View style={styles.nearbyList}>
              {nearbyList.map((item) => {
                const b = getHealthBadgeStyle(item.health_status);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setQrInput(item.asset_code);
                      handleLookup(item.asset_code);
                    }}
                    style={styles.nearbyItem}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nearbyCode}>{item.asset_code}</Text>
                      <Text style={styles.nearbyDesc} numberOfLines={1}>
                        {item.location_description}
                      </Text>
                    </View>
                    <View style={[styles.nearbyBadge, { backgroundColor: b.bg }]}>
                      <Text style={[styles.nearbyBadgeText, { color: b.text }]}>{b.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  searchBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  presetSection: {
    marginTop: 12,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assetCodeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  assetTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 2,
  },
  healthBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  healthBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  inspectionBox: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inspectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inspectionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  starBtn: {
    padding: 2,
  },
  ratingLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 8,
  },
  defectInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 50,
    marginBottom: 10,
  },
  submitInspBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
  },
  submitInspBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nearbyList: {
    gap: 8,
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  nearbyCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  nearbyDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  nearbyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nearbyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
