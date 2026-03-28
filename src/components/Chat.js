import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import tw from 'twrnc';
import { supabase } from '../lib/supabase';

export default function Chat({ roomId, nickname, visible }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    };

    loadMessages();

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');

    await supabase.from('messages').insert({
      room_id: roomId,
      player_name: nickname,
      text: trimmed,
    });
  };

  if (!visible) return null;

  const renderMessage = ({ item }) => {
    const isMine = item.player_name === nickname;
    return (
      <View
        style={tw`mb-2 ${isMine ? 'items-end' : 'items-start'}`}
      >
        {!isMine && (
          <Text style={tw`text-gray-500 text-xs mb-0.5 ml-1`}>
            {item.player_name}
          </Text>
        )}
        <View
          style={tw`px-3 py-2 rounded-xl max-w-[80%] ${
            isMine ? 'bg-amber-700' : 'bg-gray-700'
          }`}
        >
          <Text style={tw`text-white text-sm`}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-gray-900 border-t border-gray-700`}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={tw`flex-1 px-3 pt-2`}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <Text style={tw`text-gray-500 text-center py-4 text-sm`}>
            Начни общение!
          </Text>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={tw`flex-row p-2 border-t border-gray-800`}>
          <TextInput
            style={tw`flex-1 bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm mr-2`}
            placeholder="Сообщение..."
            placeholderTextColor="#6b7280"
            value={text}
            onChangeText={setText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={tw`bg-amber-600 rounded-xl px-4 justify-center`}
            onPress={sendMessage}
          >
            <Text style={tw`text-white font-semibold`}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
