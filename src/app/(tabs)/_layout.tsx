import { Tabs } from 'expo-router';
import { BookmarkCheck, Compass, Home, User } from 'lucide-react-native';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0F121C',
          borderTopColor: '#1F2538',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size }) => <Home size={size ? size - 2 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Katalog',
          tabBarIcon: ({ color, size }) => <Compass size={size ? size - 2 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="blueprints"
        options={{
          title: 'Blueprint',
          tabBarIcon: ({ color, size }) => <BookmarkCheck size={size ? size - 2 : 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size ? size - 2 : 20} color={color} />,
        }}
      />
    </Tabs>
  );
}
