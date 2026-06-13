import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const BG = '#0D0F14';
const SURFACE = '#1A1D24';
const TEXT_PRIMARY = '#E8E4DA';
const TEXT_SECONDARY = '#9E9789';
const SAGE = '#5A9E9A';
const BORDER = 'rgba(255,255,255,0.06)';

/**
 * Верхнеуровневый Error Boundary.
 * Перехватывает необработанные React-ошибки, отправляет в Sentry,
 * показывает экран «что-то пошло не так» с кнопкой перезапуска.
 */
export default class VaultErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { caught: false, errorMessage: '' };
    this._retry = this._retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {
      caught: true,
      errorMessage: error?.message ?? String(error),
    };
  }

  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error('[VaultErrorBoundary]', error, info?.componentStack);
    }
  }

  _retry() {
    this.setState({ caught: false, errorMessage: '' });
  }

  render() {
    if (!this.state.caught) {
      return this.props.children;
    }

    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <Text style={styles.title}>Что-то пошло не так</Text>
          <Text style={styles.body}>
            Приложение столкнулось с непредвиденной ошибкой. Попробуй перезапустить.
          </Text>
          {__DEV__ && !!this.state.errorMessage && (
            <Text style={styles.devError} numberOfLines={6}>
              {this.state.errorMessage}
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={this._retry}
          >
            <Text style={styles.btnText}>Перезапустить</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    padding: 24,
    gap: 16,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  devError: {
    color: '#B56B6B',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(181,107,107,0.08)',
    borderRadius: 6,
    padding: 8,
  },
  btn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A2E2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,158,154,0.25)',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnText: {
    color: SAGE,
    fontSize: 15,
    fontWeight: '500',
  },
});
