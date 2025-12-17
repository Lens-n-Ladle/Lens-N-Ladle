import { useState, useRef } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null); // Stores the captured image path
  const cameraRef = useRef(null);

  if (!permission) {
    // Camera permissions are still loading
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#fff' }}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  // Function to take picture
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7, // Compress slightly for speed
          base64: false, // We don't need base64 yet, URI is faster
        });
        console.log("Photo taken:", photo.uri);
        setPhotoUri(photo.uri); // Save the local URI to state
      } catch (error) {
        console.error("Failed to take picture:", error);
      }
    }
  };

  // If we have a photo, show the preview screen
  if (photoUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.buttonRow}>
            <Button title="Retake" onPress={() => setPhotoUri(null)} color="red" />
            <Button title="Analyze (Next Step)" onPress={() => alert("Ready to send to backend!")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Otherwise, show the Camera
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
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewImage: {
    width: '100%',
    height: '80%',
    borderRadius: 10,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 20,
  },
});