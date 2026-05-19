import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, TextInput, RefreshControl, ActivityIndicator, Modal, Alert,
  Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { transfersAPI } from '../../api/api';
import TransactionCard from '../../components/TransactionCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FRAME_SIZE = Math.min(SCREEN_W, SCREEN_H) * 0.6;

// ✅ خط المسح المتحرك
const ScanLine = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_SIZE - 4] });
  return <Animated.View style={{ position: 'absolute', left: 4, right: 4, height: 2, backgroundColor: '#00FF88', opacity: 0.9, transform: [{ translateY }] }} />;
};

const STATUS_FILTERS = [
  { key: 'all', label: 'الكل' }, { key: 'completed', label: 'مكتمل' },
  { key: 'delivered', label: 'تم التسليم' }, { key: 'pending', label: 'معلق' }, { key: 'cancelled', label: 'ملغي' },
];

export default function TransferHistoryScreen() {
  const router = useRouter();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState('all');
  const [summary, setSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('reference');
  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef(null);
  const inputRef = useRef(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => { loadTransfers(1, activeFilter); }, []);

  const loadTransfers = async (pageNum, filter) => {
    try {
      const params = { page: pageNum || page, limit: 20, status: filter !== 'all' ? filter : undefined };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await transfersAPI.getHistory(params);
      const d = res.data.data;
      if ((pageNum || page) === 1) setTransfers(d.transfers || []);
      else setTransfers(prev => [...prev, ...(d.transfers || [])]);
      setTotalPages(d.totalPages || 1); setSummary(d.summary || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); setIsSearching(false); }
  };

  const onRefresh = () => { setRefreshing(true); setPage(1); loadTransfers(1, activeFilter); };
  const handleLoadMore = () => { if (page < totalPages && !loading) { const np = page + 1; setPage(np); setLoading(true); loadTransfers(np, activeFilter); } };
  const handleFilterChange = (f) => { setActiveFilter(f); setPage(1); setLoading(true); loadTransfers(1, f); };
  const handleSearchChange = (t) => { setSearchQuery(t); if (searchTimeout.current) clearTimeout(searchTimeout.current); searchTimeout.current = setTimeout(() => { setPage(1); setIsSearching(true); loadTransfers(1, activeFilter); }, 500); };
  const clearSearch = () => { setSearchQuery(''); setPage(1); setLoading(true); loadTransfers(1, activeFilter); };
  const handleTransferPress = (t) => router.push(`/(pages)/transfer-detail?id=${t.id}`);

  const openScanner = async () => {
    const r = await requestPermission();
    if (r?.granted || r?.status === 'granted') { setScanned(false); setScannerVisible(true); }
    else Alert.alert('صلاحية', 'يرجى منح صلاحية الكاميرا');
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned || !data) return;
    setScanned(true); setScannerVisible(false);
    try {
      const qr = JSON.parse(data);
      if (qr.id) setTimeout(() => router.push(`/(pages)/transfer-detail?id=${qr.id}`), 200);
      else if (qr.ref) { setSearchQuery(qr.ref); loadTransfers(1, activeFilter); }
    } catch (e) { setSearchQuery(data); loadTransfers(1, activeFilter); }
  };

  const renderHeader = () => (
    <View>
      {summary && (
        <View style={styles.sRow}>
          <View style={styles.sCard}><Text style={styles.sLabel}>عدد التحويلات</Text><Text style={styles.sVal}>{summary.totalCount}</Text></View>
          <View style={styles.sCard}><Text style={styles.sLabel}>إجمالي المبلغ</Text><Text style={styles.sVal}>{Number(summary.totalAmount).toLocaleString('ar-SA')}</Text></View>
          <View style={styles.sCard}><Text style={styles.sLabel}>العمولات</Text><Text style={styles.sVal}>{Number(summary.totalCommission).toLocaleString('ar-SA')}</Text></View>
        </View>
      )}
      <TouchableOpacity style={styles.qrBtn} onPress={openScanner}>
        <Ionicons name="qr-code" size={20} color="#fff" /><Text style={styles.qrBtnT}>📷 مسح QR للبحث</Text>
      </TouchableOpacity>
      <View style={styles.srch}>
        <View style={styles.srchRow}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput ref={inputRef} style={styles.srchInp} placeholder={searchType === 'reference' ? 'بحث برقم المرجع...' : 'بحث باسم المستخدم...'} value={searchQuery} onChangeText={handleSearchChange} placeholderTextColor="#999" returnKeyType="search" onSubmitEditing={() => { setIsSearching(true); loadTransfers(1, activeFilter); }} />
          {searchQuery ? <TouchableOpacity onPress={clearSearch}><Ionicons name="close-circle" size={20} color="#FF4444" /></TouchableOpacity> : null}
          <TouchableOpacity onPress={() => setShowSearchOptions(!showSearchOptions)}><Ionicons name={showSearchOptions ? 'chevron-up' : 'options'} size={20} color="#6C63FF" /></TouchableOpacity>
        </View>
        {showSearchOptions && (
          <View style={styles.srchOpts}>
            {[{ key: 'reference', icon: 'barcode', label: 'رقم المرجع' }, { key: 'username', icon: 'person', label: 'اسم المستخدم' }].map(o => (
              <TouchableOpacity key={o.key} style={[styles.srchOpt, searchType === o.key && styles.srchOptA]} onPress={() => setSearchType(o.key)}>
                <Ionicons name={o.icon} size={14} color={searchType === o.key ? '#fff' : '#6C63FF'} /><Text style={[styles.srchOptT, searchType === o.key && { color: '#fff' }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <View style={styles.flt}>
        <ScrollView horizontal>{STATUS_FILTERS.map(f => (
          <TouchableOpacity key={f.key} style={[styles.fltBtn, activeFilter === f.key && styles.fltBtnA]} onPress={() => handleFilterChange(f.key)}>
            <Text style={[styles.fltTxt, activeFilter === f.key && styles.fltTxtA]}>{f.label}</Text>
          </TouchableOpacity>
        ))}</ScrollView>
      </View>
    </View>
  );

  const renderFooter = () => (!loading ? null : <View style={styles.ftr}><ActivityIndicator size="small" color="#6C63FF" /><Text style={styles.ftrT}>جاري التحميل...</Text></View>);
  const renderEmpty = () => (loading ? null : (
    <View style={styles.emp}>
      <Ionicons name="receipt-outline" size={80} color="#ccc" /><Text style={styles.empT}>{searchQuery ? 'لا توجد نتائج' : 'لا توجد تحويلات'}</Text>
      {!searchQuery && <TouchableOpacity style={styles.tfBtn} onPress={() => router.push('/(pages)/transfer')}><Text style={styles.tfBtnT}>إجراء تحويل جديد</Text></TouchableOpacity>}
    </View>
  ));

  return (
    <View style={styles.con}>
      <FlatList
        data={transfers}
        renderItem={({ item }) => <TouchableOpacity onPress={() => handleTransferPress(item)} activeOpacity={0.7}><TransactionCard transaction={item} /></TouchableOpacity>}
        keyExtractor={i => i.id.toString()}
        ListHeaderComponent={renderHeader} ListFooterComponent={renderFooter} ListEmptyComponent={renderEmpty}
        onEndReached={handleLoadMore} onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.lst} keyboardShouldPersistTaps="always"
      />
      <Modal visible={scannerVisible} animationType="fade" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.camCon}>
          <CameraView style={styles.cam} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} enableTorch={torchOn} facing="back" />
          <View style={styles.camOvr}>
            <View style={styles.camFrm}>
              <View style={styles.crnTL} /><View style={styles.crnTR} /><View style={styles.crnBL} /><View style={styles.crnBR} />
              <ScanLine />
            </View>
          </View>
          <TouchableOpacity style={styles.tchBtn} onPress={() => setTorchOn(!torchOn)}><Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={26} color="#fff" /></TouchableOpacity>
          <TouchableOpacity style={styles.clsBtn} onPress={() => setScannerVisible(false)}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
          <View style={styles.camTxtCon}><Text style={styles.camTxt}>وجه الكاميرا نحو QR Code</Text></View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  con: { flex: 1, backgroundColor: '#F5F6FA' }, lst: { padding: 15, paddingBottom: 30 },
  sRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  sCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginHorizontal: 3, alignItems: 'center', elevation: 2 },
  sLabel: { fontSize: 11, color: '#999', marginBottom: 5 }, sVal: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  qrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6C63FF', padding: 14, borderRadius: 14, marginBottom: 10, gap: 8 },
  qrBtnT: { color: '#fff', fontSize: 15, fontWeight: '600' },
  srch: { marginBottom: 10 },
  srchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 45, gap: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  srchInp: { flex: 1, fontSize: 14, color: '#333' }, srchOpts: { flexDirection: 'row', marginTop: 8, gap: 8 },
  srchOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 10, backgroundColor: '#F0EEFF', gap: 5 },
  srchOptA: { backgroundColor: '#6C63FF' }, srchOptT: { fontSize: 12, color: '#6C63FF', fontWeight: '500' },
  flt: { marginBottom: 15 },
  fltBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  fltBtnA: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' }, fltTxt: { fontSize: 13, color: '#666', fontWeight: '500' }, fltTxtA: { color: '#fff' },
  ftr: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15 }, ftrT: { marginLeft: 10, color: '#999', fontSize: 14 },
  emp: { alignItems: 'center', paddingVertical: 50 }, empT: { fontSize: 18, color: '#999', marginTop: 15, marginBottom: 20 },
  tfBtn: { backgroundColor: '#6C63FF', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25 }, tfBtnT: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  camCon: { flex: 1, backgroundColor: '#000' }, cam: { flex: 1 },
  camOvr: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  camFrm: { width: FRAME_SIZE, height: FRAME_SIZE, overflow: 'hidden' },
  crnTL: { position: 'absolute', top: 0, left: 0, width: 35, height: 35, borderTopWidth: 5, borderLeftWidth: 5, borderColor: '#fff', borderTopLeftRadius: 12 },
  crnTR: { position: 'absolute', top: 0, right: 0, width: 35, height: 35, borderTopWidth: 5, borderRightWidth: 5, borderColor: '#fff', borderTopRightRadius: 12 },
  crnBL: { position: 'absolute', bottom: 0, left: 0, width: 35, height: 35, borderBottomWidth: 5, borderLeftWidth: 5, borderColor: '#fff', borderBottomLeftRadius: 12 },
  crnBR: { position: 'absolute', bottom: 0, right: 0, width: 35, height: 35, borderBottomWidth: 5, borderRightWidth: 5, borderColor: '#fff', borderBottomRightRadius: 12 },
  tchBtn: { position: 'absolute', top: 45, left: 25, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  clsBtn: { position: 'absolute', top: 45, right: 25, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  camTxtCon: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' }, camTxt: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
