import { ProfileView } from '@/components/baby/profile-view';
import { ThemedView } from '@/components/themed-view';

/** 한눈에 보는 우리 아기 (SPEC-BABY-03). 우리 아기 탭에서 들어온다 */
export default function ProfileScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ProfileView />
    </ThemedView>
  );
}
