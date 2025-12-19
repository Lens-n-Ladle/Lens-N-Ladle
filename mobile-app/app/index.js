import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import EventSource from "react-native-sse";
// Using Ionicons for the tab icons
import { Ionicons } from '@expo/vector-icons'; 

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState('scan'); // 'scan', 'recipes', 'profile'
  
  // Camera & Recipe State
  const [photoUri, setPhotoUri] = useState(null);
  const [recipe, setRecipe] = useState("");
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // --- 1. Camera Logic ---
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: false, 
        });
        setPhotoUri(photo.uri);
      } catch (error) {
        console.error("Failed to take picture:", error);
      }
    }
  };

  const analyzeFood = async () => {
    if (!photoUri) return;
    setLoading(true);
    setRecipe(""); 

    const formData = new FormData();
    formData.append('file', {
      uri: photoUri,
      name: 'food.jpg',
      type: 'image/jpeg',
    });

    try {
      const es = new EventSource(API_URL, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
        pollingInterval: 0,
        lineEndingCharacter: "\n"
      });

      es.addEventListener("message", (event) => {
        if (event.data === "[DONE]") {
          es.close();
          setLoading(false);
        } else {
          const text = event.data.replaceAll("\\n", "\n");
          setRecipe((prev) => prev + " " + text);
        }
      });

      es.addEventListener("error", (err) => {
        console.error("Stream Error:", err);
        es.close();
        setLoading(false);
        alert("Connection Error. Check Backend!");
      });

    } catch (error) {
      console.error("Setup Error:", error);
      setLoading(false);
    }
  };

  const resetScan = () => {
    setPhotoUri(null);
    setRecipe("");
    setLoading(false);
  };

  // --- 2. Permission Screen ---
  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textBlack}>We need camera permission</Text>
        <TouchableOpacity style={styles.mainButton} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- 3. Render Content Based on Tab ---
  const renderContent = () => {
    if (activeTab === 'recipes') {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="book-outline" size={80} color="#ddd" />
          <Text style={styles.placeholderText}>Saved Recipes will appear here.</Text>
        </View>
      );
    }

    if (activeTab === 'profile') {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={80} color="#ddd" />
          <Text style={styles.placeholderText}>User Profile</Text>
        </View>
      );
    }

    // Default: 'scan' Tab
    if (photoUri) {
      // Result Screen
      return (
        <View style={styles.contentContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <Text style={styles.header}>AI Chef says:</Text>
          
          <ScrollView style={styles.resultScroll}>
            {loading && recipe === "" && <ActivityIndicator size="large" color="#000" />}
            <Text style={styles.recipeText}>{recipe}</Text>
          </ScrollView>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.secondaryButton, {marginRight: 10}]} onPress={resetScan}>
              <Text style={styles.secBtnText}>Retake</Text>
            </TouchableOpacity>
            
            {recipe === "" && !loading && (
              <TouchableOpacity style={styles.mainButton} onPress={analyzeFood}>
                <Text style={styles.btnText}>Get Recipe</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Camera Screen
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      
      {/* MAIN CONTENT AREA */}
      <View style={styles.mainArea}>
        {renderContent()}
      </View>

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('recipes')}
        >
          <Ionicons name="restaurant-outline" size={24} color={activeTab === 'recipes' ? 'black' : '#999'} />
          <Text style={[styles.navText, activeTab === 'recipes' && styles.activeNavText]}>Recipes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('scan')}
        >
          <View style={[styles.scanIconWrapper, activeTab === 'scan' && styles.activeScanWrapper]}>
            <Ionicons name="scan-outline" size={28} color="white" />
          </View>
          <Text style={[styles.navText, {marginTop: 4}, activeTab === 'scan' && styles.activeNavText]}>Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons name="person-outline" size={24} color={activeTab === 'profile' ? 'black' : '#999'} />
          <Text style={[styles.navText, activeTab === 'profile' && styles.activeNavText]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // LAYOUT
  container: { flex: 1, backgroundColor: '#fff' }, // White Background
  mainArea: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { flex: 1, padding: 20 },
  
  // TEXT & COLORS
  textBlack: { color: 'black', fontSize: 16 },
  header: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 10 },
  placeholderText: { color: '#999', marginTop: 10, fontSize: 16 },
  recipeText: { fontSize: 16, lineHeight: 24, color: '#444' },

  // CAMERA
  cameraContainer: { flex: 1, borderRadius: 20, overflow: 'hidden', margin: 10 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 30 },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },

  // RESULT SCREEN
  previewImage: { width: '100%', height: 250, borderRadius: 15, backgroundColor: '#eee' },
  resultScroll: { flex: 1, marginVertical: 10 },
  
  // BUTTONS
  actionRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10 },
  mainButton: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30 },
  secondaryButton: { backgroundColor: '#f0f0f0', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  secBtnText: { color: 'black', fontWeight: 'bold', fontSize: 16 },

  // BOTTOM NAVIGATION
  bottomNav: { 
    flexDirection: 'row', 
    height: 85, 
    borderTopWidth: 1, 
    borderTopColor: '#f0f0f0', 
    backgroundColor: '#fff',
    paddingBottom: 20, // For iPhone home bar
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  navText: { fontSize: 10, color: '#999', marginTop: 2 },
  activeNavText: { color: 'black', fontWeight: 'bold' },
  
  // Special Style for Center Scan Icon
  scanIconWrapper: {
    backgroundColor: '#000',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5
  },
  activeScanWrapper: {
    backgroundColor: '#333'
  }
});