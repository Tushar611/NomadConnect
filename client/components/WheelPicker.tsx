import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";
import * as Haptics from "expo-haptics";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelColumnProps {
  data: { value: any; label: string }[];
  selectedValue: any;
  onValueChange: (value: any) => void;
}

function WheelColumn({ data, selectedValue, onValueChange }: WheelColumnProps) {
  const { theme } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const paddedData = [
    { value: "__padding1__", label: "" },
    { value: "__padding2__", label: "" },
    ...data,
    { value: "__padding3__", label: "" },
    { value: "__padding4__", label: "" },
  ];

  const selectedIndex = data.findIndex((item) => item.value === selectedValue);

  useEffect(() => {
    if (flatListRef.current && selectedIndex >= 0 && !isScrolling) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, [selectedIndex, isScrolling]);

  const handleScrollEnd = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      
      if (data[clampedIndex] && data[clampedIndex].value !== selectedValue) {
        if (Platform.OS !== "web") {
          Haptics.selectionAsync();
        }
        onValueChange(data[clampedIndex].value);
      }
      setIsScrolling(false);
    },
    [data, selectedValue, onValueChange]
  );

  const handleItemPress = useCallback(
    (item: { value: any; label: string }, actualIndex: number) => {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      onValueChange(item.value);
      flatListRef.current?.scrollToOffset({
        offset: actualIndex * ITEM_HEIGHT,
        animated: true,
      });
    },
    [onValueChange]
  );

  const renderItem = ({ item, index }: { item: { value: any; label: string }; index: number }) => {
    const actualIndex = index - 2;
    const isSelected = actualIndex === selectedIndex;
    const isPadding = item.value.toString().startsWith("__padding");

    if (isPadding) {
      return <View style={styles.item} />;
    }

    return (
      <Pressable 
        style={styles.item} 
        onPress={() => handleItemPress(item, actualIndex)}
      >
        <ThemedText
          type="body"
          style={[
            styles.itemText,
            {
              color: isSelected ? theme.text : theme.textSecondary,
              opacity: isSelected ? 1 : 0.5,
              fontWeight: isSelected ? "600" : "400",
              fontSize: isSelected ? 20 : 16,
            },
          ]}
        >
          {item.label}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={styles.columnContainer}>
      <FlatList
        ref={flatListRef}
        data={paddedData}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.value}-${index}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={() => setIsScrolling(true)}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          if (e.nativeEvent.velocity?.y === 0) {
            handleScrollEnd(e);
          }
        }}
        onScroll={(e) => {
          if (Platform.OS === "web") {
            const offsetY = e.nativeEvent.contentOffset.y;
            const index = Math.round(offsetY / ITEM_HEIGHT);
            const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
            if (data[clampedIndex] && data[clampedIndex].value !== selectedValue) {
              onValueChange(data[clampedIndex].value);
            }
          }
        }}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        style={{ height: PICKER_HEIGHT }}
      />
    </View>
  );
}

interface DatePickerWheelProps {
  value: Date;
  onChange: (date: Date) => void;
}

export function DatePickerWheel({ value, onChange }: DatePickerWheelProps) {
  const { theme } = useTheme();

  const months = [
    { value: 0, label: "January" },
    { value: 1, label: "February" },
    { value: 2, label: "March" },
    { value: 3, label: "April" },
    { value: 4, label: "May" },
    { value: 5, label: "June" },
    { value: 6, label: "July" },
    { value: 7, label: "August" },
    { value: 8, label: "September" },
    { value: 9, label: "October" },
    { value: 10, label: "November" },
    { value: 11, label: "December" },
  ];

  const days = Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => ({
    value: currentYear + i,
    label: String(currentYear + i),
  }));

  const handleMonthChange = (month: number) => {
    const newDate = new Date(value);
    newDate.setMonth(month);
    onChange(newDate);
  };

  const handleDayChange = (day: number) => {
    const newDate = new Date(value);
    newDate.setDate(day);
    onChange(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(value);
    newDate.setFullYear(year);
    onChange(newDate);
  };

  return (
    <View style={styles.wheelContainer}>
      <View style={[styles.selectionIndicator, { borderColor: theme.border }]} />
      <View style={styles.columnsRow}>
        <WheelColumn
          data={months}
          selectedValue={value.getMonth()}
          onValueChange={handleMonthChange}
        />
        <WheelColumn
          data={days}
          selectedValue={value.getDate()}
          onValueChange={handleDayChange}
        />
        <WheelColumn
          data={years}
          selectedValue={value.getFullYear()}
          onValueChange={handleYearChange}
        />
      </View>
    </View>
  );
}

interface TimePickerWheelProps {
  value: Date;
  onChange: (date: Date) => void;
}

export function TimePickerWheel({ value, onChange }: TimePickerWheelProps) {
  const { theme } = useTheme();

  const hours = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));

  const minutes = Array.from({ length: 60 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, "0"),
  }));

  const periods = [
    { value: "AM", label: "AM" },
    { value: "PM", label: "PM" },
  ];

  const currentHour = value.getHours();
  const is12Hour = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
  const currentPeriod = currentHour >= 12 ? "PM" : "AM";

  const handleHourChange = (hour: number) => {
    const newDate = new Date(value);
    let newHour = hour;
    if (currentPeriod === "PM" && hour !== 12) {
      newHour = hour + 12;
    } else if (currentPeriod === "AM" && hour === 12) {
      newHour = 0;
    }
    newDate.setHours(newHour);
    onChange(newDate);
  };

  const handleMinuteChange = (minute: number) => {
    const newDate = new Date(value);
    newDate.setMinutes(minute);
    onChange(newDate);
  };

  const handlePeriodChange = (period: string) => {
    const newDate = new Date(value);
    let newHour = newDate.getHours();
    if (period === "PM" && newHour < 12) {
      newHour += 12;
    } else if (period === "AM" && newHour >= 12) {
      newHour -= 12;
    }
    newDate.setHours(newHour);
    onChange(newDate);
  };

  return (
    <View style={styles.wheelContainer}>
      <View style={[styles.selectionIndicator, { borderColor: theme.border }]} />
      <View style={styles.columnsRow}>
        <WheelColumn
          data={hours}
          selectedValue={is12Hour}
          onValueChange={handleHourChange}
        />
        <WheelColumn
          data={minutes}
          selectedValue={value.getMinutes()}
          onValueChange={handleMinuteChange}
        />
        <WheelColumn
          data={periods}
          selectedValue={currentPeriod}
          onValueChange={handlePeriodChange}
        />
      </View>
    </View>
  );
}

interface DurationPickerWheelProps {
  value: number;
  onChange: (hours: number) => void;
}

export function DurationPickerWheel({ value, onChange }: DurationPickerWheelProps) {
  const { theme } = useTheme();

  const durations = [
    { value: 1, label: "1 hour" },
    { value: 2, label: "2 hours" },
    { value: 3, label: "3 hours" },
    { value: 4, label: "4 hours" },
    { value: 5, label: "5 hours" },
    { value: 6, label: "6 hours" },
    { value: 8, label: "8 hours" },
    { value: 12, label: "12 hours" },
    { value: 24, label: "1 day" },
    { value: 48, label: "2 days" },
    { value: 72, label: "3 days" },
    { value: 168, label: "1 week" },
    { value: 336, label: "2 weeks" },
    { value: 720, label: "1 month" },
    { value: 1440, label: "2 months" },
    { value: 2160, label: "3 months" },
  ];

  return (
    <View style={styles.wheelContainer}>
      <View style={[styles.selectionIndicator, { borderColor: theme.border }]} />
      <View style={styles.singleColumnRow}>
        <WheelColumn
          data={durations}
          selectedValue={value}
          onValueChange={onChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheelContainer: {
    height: PICKER_HEIGHT,
    justifyContent: "center",
    position: "relative",
  },
  selectionIndicator: {
    position: "absolute",
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    backgroundColor: "rgba(128, 128, 128, 0.1)",
  },
  columnsRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  singleColumnRow: {
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 200,
  },
  columnContainer: {
    flex: 1,
    maxWidth: 120,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    textAlign: "center",
  },
});
