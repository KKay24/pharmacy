import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Pill,
  Salad,
  Dumbbell,
  Smile,
  Moon,
  Sparkles,
  Heart,
  Shield,
  ExternalLink,
  ArrowRight,
  Leaf,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface CategoryItem {
  id: string;
  label: string;
  Icon: LucideIcon;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'nutrition', label: 'Nutrition & Eating', Icon: Salad },
  { id: 'fitness', label: 'Fitness & Movement', Icon: Dumbbell },
  { id: 'mental-wellbeing', label: 'Mental Wellbeing', Icon: Smile },
  { id: 'sleep', label: 'Sleep & Rest', Icon: Moon },
  { id: 'supplements', label: 'Vitamins & Supplements', Icon: Pill },
  { id: 'personal-care', label: 'Personal & Skin Care', Icon: Sparkles },
  { id: 'baby-care', label: 'Baby & Child Care', Icon: Heart },
  { id: 'sexual-health', label: 'Sexual Health', Icon: Shield },
];

const ARTICLES = [
  {
    category: 'nutrition',
    title: 'Small steps toward healthier eating',
    description: 'Explore how balanced nutrient choices and hydration support immune health at every stage of life.',
    source: 'https://medlineplus.gov/nutrition.html',
    tag: 'Nutrition',
  },
  {
    category: 'fitness',
    title: 'Make movement part of your daily routine',
    description: 'Learn about the cardiovascular benefits of 30 minutes of daily physical activity.',
    source: 'https://medlineplus.gov/exerciseandphysicalfitness.html',
    tag: 'Fitness',
  },
  {
    category: 'mental-wellbeing',
    title: 'Understanding mental health and stress management',
    description: 'Find out what emotional wellbeing includes and practical strategies to reduce cognitive fatigue.',
    source: 'https://medlineplus.gov/mentalhealth.html',
    tag: 'Mental Health',
  },
  {
    category: 'sleep',
    title: 'Why restorative sleep matters for healing',
    description: 'Understand the circadian cycle, common sleep disruptions, and bedtime hygiene tips.',
    source: 'https://medlineplus.gov/sleepdisorders.html',
    tag: 'Sleep Hygiene',
  },
  {
    category: 'supplements',
    title: 'What to know about dietary vitamins and minerals',
    description: 'Learn about supplement safety, interactions with prescription drugs, and physician guidance.',
    source: 'https://medlineplus.gov/dietarysupplements.html',
    tag: 'Supplements',
  },
  {
    category: 'personal-care',
    title: 'Protecting your skin and barrier health',
    description: 'Discover how topical moisture, sunscreen, and gentle cleansing defend your skin.',
    source: 'https://medlineplus.gov/skinconditions.html',
    tag: 'Dermatology',
  },
  {
    category: 'baby-care',
    title: 'Infant nutrition and developmental milestones',
    description: 'Evidence-based guidance for infant feeding, weaning, and recognizing allergy signs.',
    source: 'https://medlineplus.gov/infantandnewbornnutrition.html',
    tag: 'Pediatrics',
  },
  {
    category: 'sexual-health',
    title: 'Reproductive wellness and preventative checkups',
    description: 'Access trusted medical guidelines on contraception, family planning, and sexual health.',
    source: 'https://medlineplus.gov/sexualhealth.html',
    tag: 'Reproductive Health',
  },
];

export default function HealthWellnessScreen() {
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'all') return ARTICLES;
    return ARTICLES.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

  const openSource = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>Health & Wellness Hub</Text>
            <Text style={styles.heroTitle}>Healthier Choices.{'\n'}A Brighter Tomorrow.</Text>
            <Text style={styles.heroSub}>
              Explore verified clinical health advice and preventive wellness guides vetted by licensed pharmacists.
            </Text>

            <View style={styles.trustPointsRow}>
              <View style={styles.trustPoint}>
                <ShieldCheck size={16} color="#ffffff" />
                <Text style={styles.trustText}>Evidence-informed</Text>
              </View>
              <View style={styles.trustPoint}>
                <Pill size={16} color="#ffffff" />
                <Text style={styles.trustText}>Pharmacist reviewed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Categories Carousel */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore by Category</Text>
          {selectedCategory !== 'all' && (
            <TouchableOpacity onPress={() => setSelectedCategory('all')}>
              <Text style={[styles.clearFilter, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsScroll}>
          <TouchableOpacity
            style={[
              styles.catChip,
              {
                borderColor: selectedCategory === 'all' ? colors.primary : colors.border,
                backgroundColor: selectedCategory === 'all' ? colors.primary + '15' : colors.surface,
              },
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text
              style={[
                styles.catChipText,
                {
                  color: selectedCategory === 'all' ? colors.primary : colors.text,
                  fontWeight: selectedCategory === 'all' ? '800' : '600',
                },
              ]}
            >
              All Topics
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <cat.Icon
                  size={16}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.catChipText,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Articles List */}
        <View style={styles.articlesList}>
          {filteredArticles.map((article) => (
            <Card key={article.title} style={styles.articleCard}>
              <View style={styles.cardHeader}>
                <Badge label={article.tag} variant="primary" size="sm" />
                <TouchableOpacity onPress={() => openSource(article.source)} style={styles.externalLinkIcon}>
                  <ExternalLink size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.articleTitle, { color: colors.text }]}>{article.title}</Text>
              <Text style={[styles.articleDesc, { color: colors.textMuted }]}>{article.description}</Text>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.sourceText, { color: colors.textMuted }]}>
                  Source: MedlinePlus / U.S. NLM
                </Text>
                <TouchableOpacity
                  style={styles.readBtn}
                  onPress={() => openSource(article.source)}
                >
                  <Text style={[styles.readBtnText, { color: colors.primary }]}>Read Article</Text>
                  <ArrowRight size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        {/* Quote Footer Card */}
        <Card style={[styles.quoteCard, { backgroundColor: colors.surfaceMuted }]}>
          <Leaf size={28} color={colors.primary} />
          <Text style={[styles.quoteText, { color: colors.text }]}>
            "Wellness isn't a destination, it's a daily choice. Better choices today create a healthier you tomorrow."
          </Text>
          <Text style={[styles.quoteAuthor, { color: colors.textMuted }]}>
            MediQuick Clinical Advisory Team
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  heroContent: {
    gap: 8,
  },
  eyebrow: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  heroSub: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
    marginTop: 4,
  },
  trustPointsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  trustPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  clearFilter: {
    fontSize: 13,
    fontWeight: '700',
  },
  catChipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 13,
  },
  articlesList: {
    gap: 12,
  },
  articleCard: {
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  externalLinkIcon: {
    padding: 4,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  articleDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 11,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quoteCard: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  quoteAuthor: {
    fontSize: 12,
    fontWeight: '600',
  },
});
