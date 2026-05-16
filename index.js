import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';

// Side effect: sets globalThis.__VAULT_SUPABASE_URL__ before App → supabase.js loads
import './src/lib/resolveSupabaseBaseUrl';
import RootBootstrap from './RootBootstrap';

registerRootComponent(RootBootstrap);
