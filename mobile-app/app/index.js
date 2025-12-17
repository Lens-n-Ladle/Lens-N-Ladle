import { useState, useRef } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity, SafeAreaView, Image, ScrollView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import EventSource from "react-native-sse";

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [recipe, setRecipe] = useState("");
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  console.log("Using API URL:", API_URL);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need camera permission</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5, // Compress for speed
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
    setRecipe(""); // Clear previous recipe

    // 1. Prepare the image data
    const formData = new FormData();
    formData.append('file', {
      uri: photoUri,
      name: 'food.jpg',
      type: 'image/jpeg',
    });

    try {
      // 2. Open the Real-time Stream
      const es = new EventSource(API_URL, {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        body: formData,
      });

      // 3. Listen for words coming from the server
      es.addEventListener("message", (event) => {
        if (event.data === "[DONE]") {
          es.close();
          setLoading(false);
        } else {
          // Fix newlines that we escaped in Python
          const text = event.data.replaceAll("\\n", "\n");
          setRecipe((prev) => prev + text);
        }
      });

      es.addEventListener("error", (err) => {
        console.error("Stream Error:", err);
        es.close();
        setLoading(false);
        alert("Connection Error. Check your IP address!");
      });

    } catch (error) {
      console.error("Setup Error:", error);
      setLoading(false);
    }
  };

  const reset = () => {
    setPhotoUri(null);
    setRecipe("");
    setLoading(false);
  };

  // --- RENDER RESULTS SCREEN ---
  if (photoUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          
          <Text style={styles.header}>AI Chef says:</Text>
          
          <ScrollView style={styles.scrollView}>
            {loading && recipe === "" && <ActivityIndicator size="large" color="#00ff00" />}
            <Text style={styles.recipeText}>{recipe}</Text>
          </ScrollView>
          
          <View style={styles.buttonRow}>
            <Button title="Retake" onPress={reset} color="red" />
            {/* Only show Analyze button if we haven't started yet */}
            {recipe === "" && !loading && (
              <Button title="Get Recipe" onPress={analyzeFood} />
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- RENDER CAMERA SCREEN ---
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef}>
        <View style={styles.cameraOverlay}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  text: { color: 'white', textAlign: 'center' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  
  resultContainer: { flex: 1, padding: 20, backgroundColor: '#1a1a1a' }, // Dark mode background
  previewImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 15 },
  header: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  scrollView: { flex: 1, marginBottom: 20, padding: 10, backgroundColor: '#333', borderRadius: 8 },
  recipeText: { fontSize: 16, lineHeight: 24, color: '#eee' }, // Light text for dark mode
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 20 },
});