import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { V } from '../theme';

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
    backgroundColor: V.bgApp,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: V.bgSurface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    padding: 24,
    gap: 16,
  },
  title: {
    color: V.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    color: V.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  devError: {
    color: V.dangerMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: V.bgElevated,
    borderRadius: 6,
    padding: 8,
  },
  btn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: V.btnPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnText: {
    color: V.accentSage,
    fontSize: 15,
    fontWeight: '500',
  },
});
