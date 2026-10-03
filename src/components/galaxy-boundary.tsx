import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** 그림에서 오류가 나도 탭 전체가 깨지지 않게 — 지도 자리에 한 줄만 남긴다 */
export class GalaxyBoundary extends Component<{ height: number; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={[styles.fallback, { height: this.props.height }]}>
        <Text style={styles.fallbackText}>지식 지도를 그리지 못했어요</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
