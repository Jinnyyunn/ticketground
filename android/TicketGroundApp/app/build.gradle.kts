import org.jetbrains.kotlin.gradle.dsl.JvmTarget

val playIntegrityProjectNumber = providers.environmentVariable("TIG_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER")
  .orElse(providers.gradleProperty("ticketground.playIntegrityCloudProjectNumber"))
  .getOrElse("")
require(playIntegrityProjectNumber.isBlank() || playIntegrityProjectNumber.all(Char::isDigit)) {
  "Play Integrity Cloud project number must contain digits only"
}

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
}

if (file("google-services.json").isFile) {
  apply(plugin = "com.google.gms.google-services")
}

android {
  namespace = "kr.ticketground.app"
  compileSdk = 37

  defaultConfig {
    applicationId = "kr.ticketground.app"
    minSdk = 26
    targetSdk = 37
    versionCode = 1
    versionName = "0.1.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    buildConfigField("String", "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER", "\"$playIntegrityProjectNumber\"")
  }

  buildFeatures {
    buildConfig = true
    compose = true
  }

  flavorDimensions += "environment"
  productFlavors {
    create("dev") {
      dimension = "environment"
      applicationIdSuffix = ".dev"
      buildConfigField("String", "API_BASE_URL", "\"https://dev.ticketground.co.kr\"")
    }
    create("prod") {
      dimension = "environment"
      buildConfigField("String", "API_BASE_URL", "\"https://ticketground.co.kr\"")
    }
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
    }
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  lint {
    abortOnError = true
    checkReleaseBuilds = true
  }
}

kotlin {
  compilerOptions {
    jvmTarget.set(JvmTarget.JVM_17)
  }
}

dependencies {
  implementation(platform(libs.androidx.compose.bom))
  androidTestImplementation(platform(libs.androidx.compose.bom))

  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.appcompat)
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.navigation.compose)
  implementation(libs.androidx.material3.adaptive.navigation.suite)
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.material.icons.extended)
  implementation(libs.kotlinx.coroutines.android)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.okhttp)
  implementation(libs.coil.compose)
  implementation(libs.coil.network.okhttp)
  implementation(libs.coil.svg)
  implementation(libs.play.integrity)
  implementation(libs.firebase.messaging)
  implementation(libs.firebase.installations)
  implementation(libs.toss.payments)

  debugImplementation(libs.androidx.compose.ui.tooling)
  debugImplementation(libs.androidx.compose.ui.test.manifest)

  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.okhttp.mockwebserver)
  testImplementation(libs.okhttp.tls)

  androidTestImplementation(libs.androidx.junit)
  androidTestImplementation(libs.androidx.espresso.core)
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
