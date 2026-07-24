package com.housie.controller;

import com.housie.model.Player;
import com.housie.model.Room;
import com.housie.service.HousieGameService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;

@Controller
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class HousieWebSocketController {

    private final HousieGameService gameService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/createRoom")
    public void createRoom(@Payload CreateRoomRequest request) {
        Room room = gameService.createRoom(
                request.getGameName(),
                request.getHostName(),
                request.getHostUid(),
                request.getMaxPlayers(),
                request.getCallingInterval()
        );
        messagingTemplate.convertAndSend("/topic/room/" + room.getRoomCode() + "/created", room);
    }

    @MessageMapping("/joinRoom")
    public void joinRoom(@Payload JoinRoomRequest request) {
        Player player = gameService.joinRoom(
                request.getRoomCode(),
                request.getNickname(),
                request.getUserUid()
        );
        messagingTemplate.convertAndSend("/topic/room/" + request.getRoomCode() + "/joined", player);
    }

    @MessageMapping("/startGame/{roomCode}")
    public void startGame(@DestinationVariable String roomCode, @Payload StartGameRequest request) {
        gameService.startGame(roomCode, request.getHostUid());
    }

    @Data
    public static class CreateRoomRequest {
        private String gameName;
        private String hostName;
        private String hostUid;
        private Integer maxPlayers;
        private Integer callingInterval;
    }

    @Data
    public static class JoinRoomRequest {
        private String roomCode;
        private String nickname;
        private String userUid;
    }

    @Data
    public static class StartGameRequest {
        private String hostUid;
    }
}
