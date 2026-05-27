import { StyleSheet } from 'react-native';
import { V } from '../theme';

export const PROFILE_MODAL_BTN_RADIUS = 10;
export const PROFILE_MODAL_BTN_GAP = 6;

export const profileModalBtnStyles = StyleSheet.create({
  stack: {
    gap: PROFILE_MODAL_BTN_GAP },
  btn: {
    borderRadius: PROFILE_MODAL_BTN_RADIUS,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8 },
  btnText: {
    fontSize: 14,
    fontWeight: '400',
    color: V.textPrimary },
  btnTextMuted: {
    fontSize: 13,
    fontWeight: '400',
    color: V.textSecondary },
  btnTextDanger: {
    fontSize: 14,
    fontWeight: '400',
    color: V.dangerMuted } });
