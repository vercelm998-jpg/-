// =====================================================
// ضع هذا في أعلى الملف مع باقي الـ imports
// =====================================================
import {
  Animated,        // ✅ أضف هذا
  Vibration,       // ✅ أضف هذا
  Dimensions,
  Platform,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FRAME_SIZE = Math.min(SCREEN_W, SCREEN_H) * 0.65;

// =====================================================
// مكوّن ScanLine — ضعه خارج الـ component الرئيسي تماماً
// =====================================================
const ScanLine = () => {
  const anim = useRef(new Animated.Value(0)).current;   // ✅ Animated مستوردة

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE - 4],
  });

  return (
    <Animated.View                         // ✅ مباشرة بدون require()
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        height: 2,
        backgroundColor: '#00FF88',
        opacity: 0.85,
        transform: [{ translateY }],
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      }}
    />
  );
};
