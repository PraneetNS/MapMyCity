import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import {
  HelpCircle,
  X,
  Search,
  Sparkles,
  ChevronRight,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { queryFAQAssistant, FAQ_KNOWLEDGE_BASE, FAQEntry } from '../services/faqAssistant';
import { Button } from './Button';
import { Card } from './Card';


interface FAQHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FAQHelpModal({ visible, onClose }: FAQHelpModalProps) {
  const { theme, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedFAQ, setSelectedFAQ] = useState<FAQEntry | null>(null);

  const matchResult = query ? queryFAQAssistant(query) : null;

  const handleSelectEntry = (entry: FAQEntry) => {
    setSelectedFAQ(entry);
    setQuery(entry.question);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@crowdsense.in?subject=Civic%20App%20Inquiry');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
                <HelpCircle size={20} color="#4F46E5" />
              </View>
              <div>
                <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Civic FAQ Assistant
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B' }}>
                  Grounded app guides & reporting answers
                </Text>
              </div>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View
            style={[
              styles.searchBar,
              { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: isDark ? '#334155' : '#E2E8F0' },
            ]}
          >
            <Search size={18} color="#94A3B8" />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
              placeholder="Ask about clusters, privacy, status, etc..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={(txt) => {
                setQuery(txt);
                setSelectedFAQ(null);
              }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setSelectedFAQ(null); }}>
                <X size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          {/* Body Content */}
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Search Match Result View */}
            {query.length > 0 && matchResult && (
              <View style={{ gap: 12 }}>
                {matchResult.matched && matchResult.bestMatch ? (
                  <Card style={{ backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: '#818CF8', borderWidth: 1, padding: 16, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={16} color="#6366F1" />
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#C7D2FE' : '#4338CA' }}>
                        Verified FAQ Answer
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                      {matchResult.bestMatch.question}
                    </Text>
                    <Text style={{ fontSize: 13, color: isDark ? '#E2E8F0' : '#334155', lineHeight: 20 }}>
                      {matchResult.bestMatch.answer}
                    </Text>
                  </Card>
                ) : matchResult.fallbackToSupport ? (
                  <Card style={{ backgroundColor: isDark ? '#1E293B' : '#FEF2F2', borderColor: '#F87171', borderWidth: 1, padding: 16, gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#DC2626' }}>
                      No Exact Match in App Guide
                    </Text>
                    <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#475569', lineHeight: 18 }}>
                      To prevent incorrect information, this assistant only answers from verified app knowledge bases. For complex municipal inquiries or complaints, contact our Grievance Officer directly.
                    </Text>
                    <Button
                      title="Contact Grievance / Support"
                      onPress={handleContactSupport}
                      style={{ marginTop: 6 }}
                    />

                  </Card>
                ) : null}
              </View>
            )}

            {/* Curated Question List */}
            <View style={{ marginTop: query.length > 0 ? 16 : 4, gap: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Frequently Asked Questions
              </Text>
              {FAQ_KNOWLEDGE_BASE.map((faq) => (
                <Pressable
                  key={faq.id}
                  onPress={() => handleSelectEntry(faq)}
                  style={[
                    styles.faqRow,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.faqQuestion, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                      {faq.question}
                    </Text>
                    {selectedFAQ?.id === faq.id && (
                      <Text style={[styles.faqAnswer, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                        {faq.answer}
                      </Text>
                    )}
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <Pressable onPress={handleContactSupport} style={styles.supportLink}>
              <Mail size={15} color="#4F46E5" />
              <Text style={{ fontSize: 12, color: '#4F46E5', fontWeight: '700' }}>
                Need help? Email Grievance Officer
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
  },
  faqAnswer: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
