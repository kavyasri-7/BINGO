package com.housie.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.housie.model.*;
import com.housie.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
public class HousieGameService {

    private final RoomRepository roomRepository;
    private final PlayerRepository playerRepository;
    private final TicketRepository ticketRepository;
    private final CalledNumbersRepository calledNumbersRepository;
    private final WinnerRepository winnerRepository;
    private final TambolaTicketGenerator ticketGenerator;
    private final SimpMessagingTemplate messagingTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, ScheduledFuture<?>> activeCallingTasks = new ConcurrentHashMap<>();

    public Room createRoom(String gameName, String hostName, String hostUid, Integer maxPlayers, Integer callingInterval) {
        String roomCode = String.format("%06d", new Random().nextInt(900000) + 100000);

        Room room = Room.builder()
                .roomCode(roomCode)
                .gameName(gameName)
                .hostId(hostUid)
                .hostName(hostName)
                .maxPlayers(maxPlayers)
                .callingIntervalSeconds(callingInterval != null ? callingInterval : 3)
                .status("WAITING")
                .createdAt(LocalDateTime.now())
                .build();

        Room savedRoom = roomRepository.save(room);

        joinRoom(roomCode, hostName, hostUid, true);
        return savedRoom;
    }

    public Player joinRoom(String roomCode, String nickname, String userUid, boolean isHost) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (!"WAITING".equals(room.getStatus())) {
            throw new IllegalStateException("This room is locked because the game has already started.");
        }

        if (room.getMaxPlayers() != null && playerRepository.countByRoomCode(roomCode) >= room.getMaxPlayers()) {
            throw new IllegalStateException("Room is full.");
        }

        Player player = playerRepository.findByRoomCodeAndUserUid(roomCode, userUid)
                .orElseGet(() -> {
                    Player newPlayer = Player.builder()
                            .roomCode(roomCode)
                            .nickname(nickname)
                            .userUid(userUid)
                            .isHost(isHost)
                            .joinedTime(LocalDateTime.now())
                            .build();

                    Player saved = playerRepository.save(newPlayer);

                    // Generate ticket
                    try {
                        Integer[][] ticketGrid = ticketGenerator.generateTicket();
                        String json = objectMapper.writeValueAsString(ticketGrid);

                        Ticket ticket = Ticket.builder()
                                .roomCode(roomCode)
                                .userUid(userUid)
                                .ticketNumbersJson(json)
                                .build();

                        ticketRepository.save(ticket);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }

                    return saved;
                });

        broadcastRoomState(roomCode);
        return player;
    }

    public Player joinRoom(String roomCode, String nickname, String userUid) {
        return joinRoom(roomCode, nickname, userUid, false);
    }

    public void startGame(String roomCode, String hostUid) {
        Room room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        if (!room.getHostId().equals(hostUid)) {
            throw new SecurityException("Only Host can start the game");
        }

        room.setStatus("PLAYING");
        roomRepository.save(room);

        broadcastRoomState(roomCode);

        // Schedule number calling loop
        startNumberCalling(roomCode, room.getCallingIntervalSeconds());
    }

    private void startNumberCalling(String roomCode, int intervalSeconds) {
        List<Integer> sequence = new ArrayList<>();
        for (int i = 1; i <= 90; i++) sequence.add(i);
        Collections.shuffle(sequence);

        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        final int[] index = {0};

        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            if (index[0] >= 90) {
                Room room = roomRepository.findByRoomCode(roomCode).orElse(null);
                if (room != null) {
                    room.setStatus("FINISHED");
                    roomRepository.save(room);
                    broadcastRoomState(roomCode);
                }
                stopCalling(roomCode);
                return;
            }

            int nextNum = sequence.get(index[0]++);
            CalledNumbers cn = CalledNumbers.builder()
                    .roomCode(roomCode)
                    .calledNumber(nextNum)
                    .calledTime(LocalDateTime.now())
                    .build();

            calledNumbersRepository.save(cn);

            Map<String, Object> payload = new HashMap<>();
            payload.type = "NUMBER_GENERATED";
            payload.put("number", nextNum);
            payload.put("calledCount", index[0]);

            messagingTemplate.convertAndSend("/topic/room/" + roomCode, payload);
            broadcastRoomState(roomCode);

        }, 0, intervalSeconds, TimeUnit.SECONDS);

        activeCallingTasks.put(roomCode, task);
    }

    public void stopCalling(String roomCode) {
        ScheduledFuture<?> task = activeCallingTasks.remove(roomCode);
        if (task != null) {
            task.cancel(true);
        }
    }

    public void broadcastRoomState(String roomCode) {
        Optional<Room> roomOpt = roomRepository.findByRoomCode(roomCode);
        if (roomOpt.isEmpty()) return;

        Room room = roomOpt.get();
        List<Player> players = playerRepository.findByRoomCode(roomCode);
        List<CalledNumbers> called = calledNumbersRepository.findByRoomCodeOrderByCalledTimeAsc(roomCode);
        List<Winner> winners = winnerRepository.findByRoomCode(roomCode);

        Map<String, Object> state = new HashMap<>();
        state.put("room", room);
        state.put("players", players);
        state.put("calledNumbers", called.stream().map(CalledNumbers::getCalledNumber).toList());
        state.put("winners", winners);

        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/state", state);
    }
}
