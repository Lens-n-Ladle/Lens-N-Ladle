import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, ActivityIndicator, StatusBar, Alert, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import EventSource from "react-native-sse";
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { jwtDecode } from "jwt-decode";

import { Ionicons } from '@expo/vector-icons'; 

import { supabase } from '../lib/supabase'; // Import the file you just made
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState('scan'); // 'scan', 'recipes', 'profile'
  
  // Camera & Recipe State
  const [session, setSession] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [recipe, setRecipe] = useState("");
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // --- 1. AUTH SETUP (Load Session on Startup) ---
  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const handleAppStateChange = (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.unsubscribe();
      appStateListener.remove();
    };
  }, []);

  // --- 2. GOOGLE LOGIN ---
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: "962354202222-le95s22i2172sps7jiam0rn1o56bgtmv.apps.googleusercontent.com", // <--- PASTE IT HERE
    iosClientId: "962354202222-le95s22i2172sps7jiam0rn1o56bgtmv.apps.googleusercontent.com",
    responseType: "id_token", // Supabase Requires ID_Token as well
    redirectUri: makeRedirectUri({
      scheme: 'mobile-app' // Must match app.json
    }),
  });

  const handleGoogleSignIn = async () => {
    try {
      promptAsync({
      extraParams: {
        // This is the magic line. It forces a fresh login prompt,
        // ensuring we get a NEW token without the old nonce attached.
        prompt: 'select_account', 
      }
    });
    } catch (e) {
      console.error("Crypto Error:", e);
    }
  };

  useEffect(() => {
    const handleResponse = async () => {
      if (response?.type === 'success') {
        const { id_token } = response.params;

        handleSupabaseLogin(id_token);
      } 
      else if (response?.type === 'error') {
        Alert.alert("Google Auth Error", "Could not connect to Google.");
      }
    };

    handleResponse();
  }, [response]);

  const handleSupabaseLogin = async (idToken) => {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    
    // 2. Log the Supabase result
    if (error) {
      console.error("❌ Supabase Login Error:", error.message);
      Alert.alert("Login Failed", error.message);
    } else {
      console.log("🎉 Supabase Session Created:", data.session?.user?.email);
      setActiveTab('profile');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- 1. Camera Logic ---
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true, 
        });
        setPhotoUri(photo.uri);
        setPhotoBase64(photo.base64);
      } catch (error) {
        console.error("Failed to take picture:", error);
      }
    }
  };

  const analyzeFood = async () => {
    if (!photoBase64) return;

    // Check if user is logged in before scanning (Optional: remove if you want guests to scan)
    if (!session) {
      Alert.alert("Sign In Required", "Please sign in to analyze food.");
      setActiveTab('profile');
      return;
    }

    setLoading(true);
    setRecipe(""); 

    try {
      // Get the Supabase Access Token to secure the backend request
      const { access_token } = session;

      const es = new EventSource(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}` // <--- SEND TOKEN TO BACKEND
        },
        body: JSON.stringify({ 
          image: photoBase64 
        }),
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
        console.log("SERVER ERROR DETAILS:", JSON.stringify(err, null, 2));
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

  // --- 4. RENDER UI ---
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

  const renderContent = () => {
    // A. RECIPES TAB
    if (activeTab === 'recipes') {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="book-outline" size={80} color="#ddd" />
          <Text style={styles.placeholderText}>Saved Recipes will appear here.</Text>
        </View>
      );
    }

    // B. PROFILE TAB (Login Logic Here)
    if (activeTab === 'profile') {
      // STATE 1: LOGGED IN
      if (session && session.user) {
        const { user } = session;
        const avatarUrl = user.user_metadata.avatar_url;
        const name = user.user_metadata.full_name || "User";

        return (
          <View style={styles.centerContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle" size={100} color="#333" />
            )}
            
            <Text style={styles.header}>Welcome, {name}!</Text>
            <Text style={styles.textBlack}>{user.email}</Text>
            
            <TouchableOpacity style={[styles.secondaryButton, {marginTop: 30}]} onPress={handleLogout}>
              <Text style={styles.secBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // STATE 2: NOT LOGGED IN
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={80} color="#ddd" />
          <Text style={styles.header}>Your Profile</Text>
          <Text style={{color: '#666', marginBottom: 20, textAlign: 'center', paddingHorizontal: 40}}>
            Sign in to save your recipe history and access premium features.
          </Text>
          
          <TouchableOpacity 
            style={styles.googleButton} 
            disabled={!request} 
            onPress={handleGoogleSignIn}
          >
            <Ionicons name="logo-google" size={20} color="white" style={{marginRight: 10}} />
            <Text style={styles.btnText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // C. SCAN TAB (Result or Camera)
    if (photoUri) {
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

    // D. DEFAULT: CAMERA
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
      <View style={styles.mainArea}>{renderContent()}</View>
      
      {/* NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('recipes')}>
          <Ionicons name="restaurant-outline" size={24} color={activeTab === 'recipes' ? 'black' : '#999'} />
          <Text style={[styles.navText, activeTab === 'recipes' && styles.activeNavText]}>Recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('scan')}>
          <View style={[styles.scanIconWrapper, activeTab === 'scan' && styles.activeScanWrapper]}>
            <Ionicons name="scan-outline" size={28} color="white" />
          </View>
          <Text style={[styles.navText, {marginTop: 4}, activeTab === 'scan' && styles.activeNavText]}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
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

  googleButton: { 
    flexDirection: 'row', 
    backgroundColor: '#DB4437', 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 30, 
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20
  },

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
    boxShadow: '0px 2px 5px rgba(0,0,0,0.2)',
    elevation: 5
  },
  activeScanWrapper: {
    backgroundColor: '#333'
  }
});