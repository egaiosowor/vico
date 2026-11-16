import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Incident } from '../types';
import { FLAG_OPTIONS, FlagReason, FlagOption } from '../services/moderationService';

interface IncidentActionSheetProps {
  visible: boolean;
  incident: Incident | null;
  onClose: () => void;
  onFlag: (incidentId: string, reason: FlagReason) => void;
}

export const IncidentActionSheet: React.FC<IncidentActionSheetProps> = ({
  visible,
  incident,
  onClose,
  onFlag,
}) => {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<'main' | 'reasons'>('main');

  // Reset to main step whenever modal opens or closes
  useEffect(() => {
    if (visible) {
      setCurrentStep('main');
    }
  }, [visible]);

  if (!incident) return null;

  const handleSelectReason = (reasonKey: FlagReason) => {
    onFlag(incident.id, reasonKey);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                { paddingBottom: Math.max(insets.bottom, 20) + 8 },
              ]}
            >
              {/* iOS Drag Handle */}
              <View style={styles.handle} />

              {currentStep === 'main' ? (
                /* Main Action Sheet - Apple Dark / Action Sheet Style */
                <View style={styles.content}>
                  {/* Action Group Card */}
                  <View style={styles.actionGroupCard}>
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => setCurrentStep('reasons')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.iconCircle}>
                        <Ionicons name="flag-outline" size={20} color="#FF453A" />
                      </View>
                      <View style={styles.actionTextWrap}>
                        <Text style={styles.actionTitleDanger}>Report</Text>
                        <Text style={styles.actionSubtitle}>
                          Report false alert, graphic media, or violation
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="rgba(255, 255, 255, 0.3)"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Separate iOS Cancel Button */}
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Flag Reason Selection View */
                <View style={styles.content}>
                  {/* Header Row */}
                  <View style={styles.stepHeaderRow}>
                    <TouchableOpacity
                      onPress={() => setCurrentStep('main')}
                      style={styles.backButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <Text style={styles.stepTitle}>Report Post</Text>

                    <TouchableOpacity
                      onPress={onClose}
                      style={styles.closeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.stepSubtitle}>
                    Why are you reporting this post?
                  </Text>

                  {/* Reasons Group Card */}
                  <View style={styles.reasonsGroupCard}>
                    {FLAG_OPTIONS.map((opt: FlagOption, index) => {
                      const isLast = index === FLAG_OPTIONS.length - 1;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.reasonRow,
                            !isLast && styles.reasonRowDivider,
                          ]}
                          onPress={() => handleSelectReason(opt.key)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.reasonTextWrap}>
                            <Text style={styles.reasonLabel}>{opt.label}</Text>
                            <Text style={styles.reasonDesc}>{opt.description}</Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="rgba(255, 255, 255, 0.3)"
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  content: {
    width: '100%',
  },
  actionGroupCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  actionTitleDanger: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF453A',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 16,
  },
  cancelButton: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 2,
  },
  reasonsGroupCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  reasonRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  reasonTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  reasonDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 15,
  },
});
