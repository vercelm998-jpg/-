// =====================================================
// الاستبدال الكامل لقسم الكاميرا في TransferHistoryScreen
// =====================================================
// 1. استبدل imports بهذه:

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, TextInput, RefreshControl, ActivityIndicator,
  Modal, Alert, Dimensions, Platform, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { transfersAPI } from '../../api/api';
import TransactionCard from '../../components/TransactionCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FRAME_SIZE = Math.min(SCREEN_W, SCREEN_H) * 0.65; // إطار مرن حسب حجم الشاشة

// =====================================================
// 2. داخل الـ component، استبدل state الكاميرا بـ:

/*
  const [scannerVisible, setScannerVisible]   = useState(false);
  const [torchOn, setTorchOn]                 = useState(false);
  const [permission, requestPermission]       = useCameraPermissions();
  const [scanned, setScanned]                 = useState(false);
  const [zoom, setZoom]                       = useState(0);       // ✅ جديد
  const [scanFeedback, setScanFeedback]       = useState(false);   // ✅ جديد
  const scanCooldown                          = useRef(false);     // ✅ جديد: منع التكرار السريع
*/

// =====================================================
// 3. استبدل دالة openScanner بـ:

const openScanner = async () => {
  let current = permission;
  if (!current?.granted) {
    current = await requestPermission();
  }
  if (current?.granted) {
    setScanned(false);
    setZoom(0);
    setTorchOn(false);
    setScanFeedback(false);
    setScannerVisible(true);
  } else {
    Alert.alert(
      'صلاحية الكاميرا مطلوبة',
      'يرجى منح صلاحية الكاميرا من إعدادات الجهاز للتمكن من مسح QR Code',
      [{ text: 'حسناً' }]
    );
  }
};

// =====================================================
// 4. استبدل handleBarCodeScanned بـ:

const handleBarCodeScanned = useCallback(({ data, bounds, cornerPoints }) => {
  // منع المسح المتكرر
  if (scanned || scanCooldown.current || !data) return;

  scanCooldown.current = true;
  setScanned(true);
  setScanFeedback(true); // إضاءة بصرية

  // اهتزاز خفيف للتأكيد
  Vibration.vibrate(80);

  setTimeout(() => {
    setScannerVisible(false);
    setScanFeedback(false);
    scanCooldown.current = false;

    try {
      const qrData = JSON.parse(data);
      if (qrData.id) {
        router.push(`/(pages)/transfer-detail?id=${qrData.id}`);
      } else if (qrData.ref) {
        setSearchQuery(qrData.ref);
        loadTransfers(1, activeFilter);
      }
    } catch (e) {
      setSearchQuery(data);
      loadTransfers(1, activeFilter);
    }
  }, 300);
}, [scanned, activeFilter]);

// =====================================================
// 5. استبدل Modal الكاميرا بالكامل بهذا:

const ScannerModal = () => (
  <Modal
    visible={scannerVisible}
    animationType="slide"
    statusBarTranslucent
    onRequestClose={() => setScannerVisible(false)}
  >
    <View style={scanStyles.container}>

      {/* الكاميرا - الإعدادات المحسّنة */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}

        // ✅ المفتاح الأساسي لتحسين جودة المسح:
        zoom={zoom}

        // ✅ تفعيل كل أنواع الباركود الممكنة
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'aztec',
            'code128',
            'code39',
            'code93',
            'ean13',
            'ean8',
            'pdf417',
            'upc_e',
            'datamatrix',
          ],
        }}

        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* طبقة التعتيم حول الإطار */}
      <View style={scanStyles.overlay}>
        {/* أعلى */}
        <View style={[scanStyles.shadow, { height: (SCREEN_H - FRAME_SIZE) / 2 - 40 }]} />

        {/* صف الإطار */}
        <View style={{ flexDirection: 'row', height: FRAME_SIZE }}>
          <View style={[scanStyles.shadow, { width: (SCREEN_W - FRAME_SIZE) / 2 }]} />

          {/* الإطار نفسه */}
          <View style={[
            scanStyles.frame,
            { width: FRAME_SIZE, height: FRAME_SIZE },
            scanFeedback && scanStyles.frameSuccess,
          ]}>
            {/* زوايا الإطار */}
            <View style={[scanStyles.corner, scanStyles.cornerTL]} />
            <View style={[scanStyles.corner, scanStyles.cornerTR]} />
            <View style={[scanStyles.corner, scanStyles.cornerBL]} />
            <View style={[scanStyles.corner, scanStyles.cornerBR]} />

            {/* خط المسح المتحرك */}
            {!scanned && <ScanLine />}
          </View>

          <View style={[scanStyles.shadow, { width: (SCREEN_W - FRAME_SIZE) / 2 }]} />
        </View>

        {/* أسفل */}
        <View style={[scanStyles.shadow, { flex: 1 }]} />
      </View>

      {/* شريط التحكم العلوي */}
      <View style={scanStyles.topBar}>
        <TouchableOpacity style={scanStyles.iconBtn} onPress={() => setScannerVisible(false)}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={scanStyles.title}>مسح QR Code</Text>

        <TouchableOpacity style={scanStyles.iconBtn} onPress={() => setTorchOn(p => !p)}>
          <Ionicons
            name={torchOn ? 'flashlight' : 'flashlight-outline'}
            size={24}
            color={torchOn ? '#FFD700' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* تحكم في التكبير */}
      <View style={scanStyles.zoomBar}>
        {[0, 0.1, 0.2, 0.3].map((val) => (
          <TouchableOpacity
            key={val}
            style={[scanStyles.zoomBtn, zoom === val && scanStyles.zoomBtnA]}
            onPress={() => setZoom(val)}
          >
            <Text style={[scanStyles.zoomTxt, zoom === val && { color: '#000' }]}>
              {val === 0 ? '1×' : val === 0.1 ? '1.5×' : val === 0.2 ? '2×' : '3×'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* نص إرشادي */}
      <View style={scanStyles.hint}>
        <Text style={scanStyles.hintTxt}>
          {scanFeedback ? '✅ تم المسح بنجاح!' : 'وجّه الكاميرا نحو QR Code داخل الإطار'}
        </Text>
      </View>

    </View>
  </Modal>
);

// =====================================================
// 6. مكوّن خط المسح المتحرك (ضعه خارج الـ component الرئيسي)

const ScanLine = () => {
  const anim = useRef(new (require('react-native').Animated.Value)(0)).current;

  useEffect(() => {
    const loop = require('react-native').Animated.loop(
      require('react-native').Animated.sequence([
        require('react-native').Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        require('react-native').Animated.timing(anim, {
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
    <require('react-native').Animated.View
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

// =====================================================
// 7. Styles للـ Scanner (أضفها في نهاية الملف)

const scanStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  shadow: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  frame: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  frameSuccess: {
    // لمعان خضراء عند النجاح
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: 4, borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: 4, borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: 4, borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: 4, borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBar: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  zoomBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  zoomBtnA: {
    backgroundColor: '#fff',
  },
  zoomTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
