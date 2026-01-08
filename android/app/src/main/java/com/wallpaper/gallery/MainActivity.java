package com.wallpaper.gallery;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 立即关闭原生启动页
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> false);
        
        super.onCreate(savedInstanceState);
        // 启用边到边显示，让内容延伸到状态栏和导航栏下方
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
